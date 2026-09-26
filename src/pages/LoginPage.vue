<script setup lang="ts">
/**
 * Sign-in: password, plus OAuth (OIDC) when the server advertises it. The
 * OAuth button hands the browser to the provider; the callback route picks the
 * session up afterwards, so nothing about the token exchange happens here.
 */
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useSnackbarStore } from '@/stores/snackbar'
import { t } from '@/i18n'
import { useSeo } from '@/composables/seo'
import { ApiError } from '@/api/http'
import { isSafeRedirect, rememberOAuthRedirect } from '@/utils/oauth'

useSeo({ title: '登录 · 地平线 Horizon' })

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const snackbar = useSnackbarStore()

const username = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')

/** Whether the gateway offers OIDC; password login is always available. */
const oauthAvailable = ref(false)
const oauthBusy = ref(false)

onMounted(async () => {
  try {
    const res = await api.providers()
    oauthAvailable.value = (res.providers ?? []).includes('oidc')
  } catch {
    // The provider probe is best-effort: a failure must not hide the form.
  }
})

async function submit() {
  if (!username.value.trim() || !password.value) return
  busy.value = true
  error.value = ''
  try {
    await auth.login(username.value.trim(), password.value)
    snackbar.show(`${t('login')} ✓`)
    const redirect = route.query.redirect
    await router.replace(typeof redirect === 'string' && isSafeRedirect(redirect) ? redirect : '/')
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

/**
 * Starts the OAuth flow. The browser leaves this page, so [oauthBusy] is only
 * cleared on failure — resetting it on success would flash the button back
 * before the navigation commits.
 */
async function oauthLogin() {
  oauthBusy.value = true
  error.value = ''
  rememberOAuthRedirect(route.query.redirect)
  try {
    const { auth_url: authUrl } = await api.oidcLogin('web')
    window.location.assign(authUrl)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : String(e)
    oauthBusy.value = false
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

      <template v-if="oauthAvailable">
        <div class="login__divider"><span>{{ t('oauthOr') }}</span></div>
        <button
          class="m3-outlined-button login__oauth"
          type="button"
          :disabled="oauthBusy"
          @click="oauthLogin"
        >
          <i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i>
          {{ oauthBusy ? '…' : t('oauthLogin') }}
        </button>
      </template>

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

.login__divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 16px 0 10px;
  color: var(--md-on-surface-variant);
  font-size: 12px;
}

.login__divider::before,
.login__divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--md-outline, var(--md-on-surface-variant));
  opacity: 0.4;
}

.login__oauth {
  width: 100%;
  justify-content: center;
  gap: 8px;
}

.login__hint {
  margin-top: 14px;
}
</style>
