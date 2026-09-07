<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useSnackbarStore } from '@/stores/snackbar'
import { t } from '@/i18n'
import AppAnnouncementDialog from '@/components/AppAnnouncementDialog.vue'

/**
 * Application shell: top bar + responsive navigation rail/side nav +
 * routed page + snackbar host. Boots the settings/auth stores once before
 * rendering (the template gates on `booted`).
 */
const route = useRoute()
const auth = useAuthStore()
const settings = useSettingsStore()
const snackbar = useSnackbarStore()

const booted = ref(false)
void Promise.all([settings.init(), auth.bootstrap()]).finally(() => {
  booted.value = true
})

const isWide = computed(() => window.innerWidth >= 900)
const navItems = computed(() => [
  { to: '/', label: t('navHome'), icon: '🏠' },
  { to: '/camps', label: t('navCamps'), icon: '🏕️' },
  { to: '/chat', label: t('navChat'), icon: '💬', auth: true },
  { to: '/settings', label: t('navSettings'), icon: '👤' },
])

function isActive(path: string): boolean {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <RouterLink to="/" class="topbar__brand">地平线 <span class="topbar__sub">Horizon</span></RouterLink>
      <div class="topbar__spacer" />
      <button
        class="m3-text-button"
        :title="settings.theme === 'dark' ? t('themeLight') : t('themeDark')"
        @click="settings.setTheme(settings.theme === 'dark' ? 'light' : 'dark')"
      >
        {{ settings.theme === 'dark' ? '☀️' : '🌙' }}
      </button>
      <template v-if="auth.isAuthenticated">
        <RouterLink to="/compose" class="m3-filled-button topbar__compose">{{ t('createPost') }}</RouterLink>
      </template>
      <template v-else>
        <RouterLink to="/login" class="m3-filled-button">{{ t('login') }}</RouterLink>
      </template>
    </header>

    <div class="shell__body">
      <nav v-if="isWide" class="sidenav" aria-label="主导航">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="sidenav__item"
          :class="{ 'sidenav__item--active': isActive(item.to) }"
        >
          <span class="sidenav__icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
        <AppAnnouncementDialog v-if="booted" />
      </nav>

      <main class="shell__main">
        <template v-if="booted">
          <RouterView />
        </template>
        <div v-else class="page"><p class="m3-label-small">…</p></div>
      </main>
    </div>

    <nav v-if="!isWide" class="bottombar" aria-label="主导航">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="bottombar__item"
        :class="{ 'bottombar__item--active': isActive(item.to) }"
      >
        <span class="bottombar__icon">{{ item.icon }}</span>
        <span class="bottombar__label">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <div v-if="snackbar.visible" class="m3-snackbar">{{ snackbar.message }}</div>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  background: var(--md-surface-container);
  box-shadow: var(--md-elev-1);
}

.topbar__brand {
  font-size: 19px;
  font-weight: 800;
  color: var(--md-primary);
  text-decoration: none;
}

.topbar__brand:hover {
  text-decoration: none;
}

.topbar__sub {
  font-size: 12px;
  font-weight: 500;
  color: var(--md-on-surface-variant);
}

.topbar__spacer {
  flex: 1;
}

.topbar__compose {
  text-decoration: none;
}

.shell__body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.sidenav {
  width: var(--nav-width);
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidenav__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-radius: var(--md-radius-full);
  color: var(--md-on-surface-variant);
  font-weight: 600;
  text-decoration: none;
}

.sidenav__item:hover {
  background: var(--md-surface-container-high);
  text-decoration: none;
}

.sidenav__item--active {
  background: var(--md-secondary-container);
  color: var(--md-on-secondary-container);
}

.sidenav__icon {
  font-size: 19px;
}

.shell__main {
  flex: 1;
  min-width: 0;
}

.bottombar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  background: var(--md-surface-container);
  box-shadow: var(--md-elev-2);
  padding-bottom: env(safe-area-inset-bottom);
}

.bottombar__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 0 10px;
  color: var(--md-on-surface-variant);
  font-size: 11.5px;
  font-weight: 600;
  text-decoration: none;
}

.bottombar__item--active {
  color: var(--md-primary);
}

.bottombar__icon {
  font-size: 20px;
}
</style>
