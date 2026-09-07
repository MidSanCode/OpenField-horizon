/**
 * UI preferences (theme + locale) persisted to localStorage. Theme writes a
 * data-theme attribute on <html>; locale swaps a tiny built-in dictionary
 * (see i18n.ts) and the document lang for crawlers.
 */
import { defineStore } from 'pinia'
import { setLocale } from '@/i18n'

export type ThemePreference = 'system' | 'light' | 'dark'
export type Locale = 'zh' | 'en'

const THEME_KEY = 'horizon.theme'
const LOCALE_KEY = 'horizon.locale'

function readTheme(): ThemePreference {
  const value = localStorage.getItem(THEME_KEY)
  return value === 'light' || value === 'dark' ? value : 'system'
}

function readLocale(): Locale {
  const value = localStorage.getItem(LOCALE_KEY)
  return value === 'en' ? 'en' : 'zh'
}

/** Applies the theme preference as an explicit data-theme attribute. */
function applyTheme(theme: ThemePreference) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme
  document.documentElement.dataset.theme = resolved
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    theme: 'system' as ThemePreference,
    locale: 'zh' as Locale,
  }),
  actions: {
    /** Restores persisted preferences and wires the system theme listener. */
    init() {
      this.theme = readTheme()
      this.locale = readLocale()
      applyTheme(this.theme)
      setLocale(this.locale)
      document.documentElement.lang = this.locale === 'zh' ? 'zh-CN' : 'en'
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.theme === 'system') applyTheme('system')
      })
    },
    setTheme(theme: ThemePreference) {
      this.theme = theme
      localStorage.setItem(THEME_KEY, theme)
      applyTheme(theme)
    },
    setLocale(locale: Locale) {
      this.locale = locale
      localStorage.setItem(LOCALE_KEY, locale)
      setLocale(locale)
      document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
    },
  },
})
