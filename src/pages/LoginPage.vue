<script setup lang="ts">
/**
 * Password sign-in. Redirects back to ?redirect= after success; the OIDC
 * flow is app-first on web (Horizon only consumes the password flow).
 */
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSnackbarStore } from '@/stores/snackbar'
import { t } from '@/i18n'
import { useSeo } from '@/composables/seo'
import { ApiError } from '@/api/http'

useSeo({ title: '登录 · 地平线 Horizon' })

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const snackbar = useSnackbarStore()

const username = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')

async function submit() {
  if (!username.value.trim() || !password.value) return
  busy.value = true
  error.value = ''
  try {
    await auth.login(username.value.trim(), password.value)
    snackbar.show(`${t('login')} ✓`)
    const redirect = route.query.redirect as string | undefined
    await router.replace(redirect && redirect.startsWith('/') ? redirect : '/')
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page login">
    <div class="m3-card m3-card--elevated login__card">
      <h1 class="login__title">地平线 <span class="m3-label-small">Horizon</span></h1>
      <p class="m3-label-small">OpenField {{ t('login') }}</p>

      <form @submit.prevent="submit">
        <label class="field">
          <span>{{ t('username') }}</span>
          <input v-model="username" class="m3-input" autocomplete="username" required />
        </label>
        <label class="field">
          <span>{{ t('password') }}</span>
          <input v-model="password" class="m3-input" type="password" autocomplete="current-password" required />
        </label>
        <p v-if="error" class="m3-error-text">{{ error }}</p>
        <button class="m3-filled-button login__submit" type="submit" :disabled="busy">
          {{ busy ? '…' : t('login') }}
        </button>
      </form>

      <p class="m3-label-small login__hint">
        {{ t('settingsApiBaseHint') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.login {
  display: flex;
  justify-content: center;
  padding-top: 8vh;
}

.login__card {
  width: min(380px, 100%);
}

.login__title {
  margin: 0;
  font-size: 24px;
  color: var(--md-primary);
}

.field {
  display: block;
  margin: 14px 0;
}

.field span {
  display: block;
  font-size: 13px;
  color: var(--md-on-surface-variant);
  margin-bottom: 4px;
}

.login__submit {
  width: 100%;
  justify-content: center;
  margin-top: 6px;
}

.login__hint {
  margin-top: 14px;
}
</style>
