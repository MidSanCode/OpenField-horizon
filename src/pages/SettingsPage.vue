<script setup lang="ts">
/**
 * Settings: API base override (self-hosting), theme + locale, session info
 * and logout. The API base writes through the http layer's localStorage keys
 * and reloads the app so every in-flight handle picks it up.
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { readApiBase, writeApiBase } from '@/api/http'
import { t } from '@/i18n'
import { useSeo } from '@/composables/seo'

useSeo({ title: '设置 · 地平线 Horizon' })

const router = useRouter()
const auth = useAuthStore()
const settings = useSettingsStore()

const apiBase = ref(readApiBase())

function applyApiBase() {
  // writeApiBase normalises the entry (a bare gateway address gains the
  // "/api/v1" prefix) and reports what is now in effect; show that before the
  // reload so the resolved value is visible rather than surprising.
  apiBase.value = writeApiBase(apiBase.value)
  window.location.reload()
}

function logout() {
  auth.logout()
  void router.replace('/')
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">{{ t('settings') }}</h1>

    <div v-if="auth.isAuthenticated && auth.user" class="m3-card m3-card--elevated account">
      <img v-if="auth.user.avatar_url" class="account__avatar" :src="auth.user.avatar_url" alt="" />
      <div class="account__names">
        <strong>{{ auth.user.nickname || auth.user.username }}</strong>
        <span class="m3-label-small">@{{ auth.user.username }}</span>
      </div>
      <RouterLink :to="`/u/${auth.user.id}`" class="m3-text-button">{{ t('myProfile') }}</RouterLink>
      <button class="m3-text-button m3-text-button--danger" @click="logout">{{ t('logout') }}</button>
    </div>

    <div class="m3-card">
      <label class="field">
        <span>{{ t('settingsApiBase') }}</span>
        <input v-model="apiBase" class="m3-input" spellcheck="false" @keydown.enter="applyApiBase" />
      </label>
      <p class="m3-label-small">{{ t('settingsApiBaseHint') }}</p>
      <button class="m3-tonal-button" @click="applyApiBase">{{ t('save') }}</button>
    </div>

    <div class="m3-card">
      <p class="m3-title-medium">{{ t('settingsTheme') }}</p>
      <div class="row">
        <button
          v-for="option in [
            { value: 'system', label: t('themeSystem') },
            { value: 'light', label: t('themeLight') },
            { value: 'dark', label: t('themeDark') },
          ]"
          :key="option.value"
          class="m3-chip m3-chip--selectable"
          :class="{ 'm3-chip--active': settings.theme === option.value }"
          @click="settings.setTheme(option.value as 'system' | 'light' | 'dark')"
        >
          {{ option.label }}
        </button>
      </div>

      <p class="m3-title-medium" style="margin-top: 14px">{{ t('settingsLocale') }}</p>
      <div class="row">
        <button
          class="m3-chip m3-chip--selectable"
          :class="{ 'm3-chip--active': settings.locale === 'zh' }"
          @click="settings.setLocale('zh')"
        >
          中文
        </button>
        <button
          class="m3-chip m3-chip--selectable"
          :class="{ 'm3-chip--active': settings.locale === 'en' }"
          @click="settings.setLocale('en')"
        >
          English
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-title {
  font-size: 22px;
  margin: 4px 0 16px;
}

.account {
  display: flex;
  align-items: center;
  gap: 12px;
}

.account__avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  object-fit: cover;
}

.account__names {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.field {
  display: block;
  margin-bottom: 6px;
}

.field span {
  display: block;
  font-size: 13px;
  color: var(--md-on-surface-variant);
  margin-bottom: 4px;
}

.row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
