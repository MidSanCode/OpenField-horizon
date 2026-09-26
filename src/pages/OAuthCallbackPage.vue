<script setup lang="ts">
/**
 * Landing route for browser (OIDC) sign-in: `/oauth/callback`.
 *
 * The server sends the browser here with one of three payloads in the query
 * string, all read once at setup and then stripped from the URL so tokens and
 * tickets never linger in the address bar or in browser history:
 *
 * - `access_token` (+ `refresh_token`) — a completed sign-in;
 * - `pick=<ticket>` — the identity is bound to several accounts, so the user
 *   picks one (or adds a new one) before any token is issued;
 * - `error` (+ `error_description`) — the provider refused, e.g. the user
 *   cancelled on the consent screen.
 *
 * A ticket is single-use, so every failure path ends somewhere actionable
 * rather than on a dead end (see [RetryMode]).
 */
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api'
import type { OAuthPickInfo } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { t } from '@/i18n'
import { useSeo } from '@/composables/seo'
import { ApiError } from '@/api/http'
import { consumeOAuthRedirect } from '@/utils/oauth'

useSeo({ title: '登录中 · 地平线 Horizon' })

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

type Phase = 'working' | 'pick' | 'error'

/**
 * What the error state should offer. `GET /auth/oidc/pick` does not consume
 * the ticket, so a failed account-list load can simply be retried; select and
 * create delete the ticket *before* validating (a single `DELETE ... RETURNING`
 * on the server), so any failure there needs a brand-new sign-in.
 */
type RetryMode = 'reload-pick' | 'relogin'

const phase = ref<Phase>('working')
const errorText = ref('')
const retryMode = ref<RetryMode>('relogin')
const pick = ref<OAuthPickInfo | null>(null)
const ticket = ref('')
const busyUserId = ref<number | null>(null)
const creating = ref(false)

/**
 * Accounts whose avatar failed to load, so the picker can show the initial
 * instead of a broken image. Keyed by account id because the list is rendered
 * with a single `v-for`, where one shared flag would hide every avatar.
 */
const failedAvatars = ref<Set<number>>(new Set())

function onAvatarError(id: number) {
  failedAvatars.value = new Set(failedAvatars.value).add(id)
}

/** Snapshot of the query at mount: the router rewrites it immediately after. */
const params = {
  accessToken: asString(route.query.access_token),
  refreshToken: asString(route.query.refresh_token),
  pick: asString(route.query.pick),
  error: asString(route.query.error),
  errorDescription: asString(route.query.error_description),
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Drops every credential from the visible URL (and from history) while staying
 * on this route. A navigation rejection is not actionable here — the sign-in
 * outcome is already decided — so it is swallowed rather than surfaced.
 */
function scrubUrl() {
  router.replace({ path: '/oauth/callback', query: {} }).catch(() => undefined)
}

function fail(message: string, mode: RetryMode = 'relogin') {
  phase.value = 'error'
  errorText.value = message
  retryMode.value = mode
  scrubUrl()
}

async function finish(accessToken: string, refreshToken: string | null) {
  await auth.applyTokens(accessToken, refreshToken)
  await router.replace(consumeOAuthRedirect())
}

async function loadPick(issued: string) {
  ticket.value = issued
  phase.value = 'working'
  errorText.value = ''
  try {
    pick.value = await api.oidcPick(issued)
    phase.value = 'pick'
    scrubUrl()
  } catch (e) {
    fail(e instanceof ApiError ? e.message : String(e), 'reload-pick')
  }
}

async function chooseAccount(userId: number) {
  busyUserId.value = userId
  errorText.value = ''
  try {
    const result = await api.oidcPickSelect(ticket.value, userId)
    await finish(result.access_token, result.refresh_token ?? null)
  } catch (e) {
    // The ticket was consumed even though the sign-in failed, so this cannot
    // be retried in place.
    fail(e instanceof ApiError ? e.message : String(e))
  } finally {
    busyUserId.value = null
  }
}

async function addAccount() {
  creating.value = true
  errorText.value = ''
  try {
    const result = await api.oidcPickCreate(ticket.value)
    await finish(result.access_token, result.refresh_token ?? null)
  } catch (e) {
    fail(e instanceof ApiError ? e.message : String(e))
  } finally {
    creating.value = false
  }
}

/** Re-runs whatever failed, or starts a fresh sign-in when it cannot be. */
function retry() {
  if (retryMode.value === 'reload-pick' && ticket.value) {
    void loadPick(ticket.value)
    return
  }
  void router.push('/login')
}

onMounted(() => {
  if (params.error) {
    fail(params.errorDescription || params.error)
    return
  }
  if (params.pick) {
    void loadPick(params.pick)
    return
  }
  if (params.accessToken) {
    void finish(params.accessToken, params.refreshToken || null).catch((e) =>
      fail(e instanceof ApiError ? e.message : String(e)),
    )
    return
  }
  fail(t('oauthMissingPayload'))
})
</script>

<template>
  <div class="page oauth">
    <div class="m3-card m3-card--elevated oauth__card">
      <!-- Completed sign-in: the router is already replacing this view. -->
      <template v-if="phase === 'working'">
        <span class="oauth__spinner" aria-hidden="true"></span>
        <p class="m3-body-medium">{{ t('oauthWorking') }}</p>
      </template>

      <template v-else-if="phase === 'pick'">
        <h1 class="oauth__title">{{ t('oauthPickTitle') }}</h1>
        <p class="m3-label-small oauth__identity">
          {{ pick?.oauth2_username || pick?.email || t('oauthProviderAccount') }}
        </p>

        <button
          v-for="account in pick?.accounts ?? []"
          :key="account.id"
          class="m3-card oauth__account"
          type="button"
          :disabled="busyUserId !== null || creating"
          @click="chooseAccount(account.id)"
        >
          <img
            v-if="account.avatar_url && !failedAvatars.has(account.id)"
            class="oauth__avatar"
            :src="account.avatar_url"
            :alt="account.username"
            @error="onAvatarError(account.id)"
          />
          <span v-else class="oauth__avatar oauth__avatar--placeholder" aria-hidden="true">
            {{ (account.nickname || account.username).slice(0, 1).toUpperCase() }}
          </span>
          <span class="oauth__account-main">
            <strong>{{ account.nickname || account.username }}</strong>
            <span class="m3-label-small">@{{ account.username }}</span>
          </span>
          <span v-if="busyUserId === account.id" class="oauth__spinner" aria-hidden="true"></span>
        </button>

        <button
          v-if="pick && pick.accounts.length < pick.max_accounts"
          class="m3-outlined-button oauth__add"
          type="button"
          :disabled="creating || busyUserId !== null"
          @click="addAccount"
        >
          {{ creating ? '…' : t('oauthAddAccount') }}
        </button>
        <p v-else-if="pick" class="m3-label-small oauth__quota">
          {{ t('oauthQuotaReached', { max: pick.max_accounts }) }}
        </p>
      </template>

      <template v-else>
        <h1 class="oauth__title">{{ t('oauthFailed') }}</h1>
        <p class="m3-error-text">{{ errorText }}</p>
        <button class="m3-filled-button oauth__retry" type="button" @click="retry">
          {{ retryMode === 'reload-pick' ? t('retry') : t('oauthRetry') }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.oauth {
  display: flex;
  justify-content: center;
  padding-top: 8vh;
}

.oauth__card {
  width: min(400px, 100%);
  text-align: center;
}

.oauth__title {
  margin: 0 0 6px;
  font-size: 20px;
  color: var(--md-primary);
}

.oauth__identity {
  margin: 0 0 14px;
  color: var(--md-on-surface-variant);
}

.oauth__account {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-bottom: 8px;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  color: var(--md-on-surface);
}

.oauth__account:disabled {
  opacity: 0.6;
  cursor: default;
}

.oauth__avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--md-radius-full);
  object-fit: cover;
  flex: none;
}

.oauth__avatar--placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--md-primary);
  color: var(--md-on-primary);
  font-weight: 600;
}

.oauth__account-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.oauth__account-main strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oauth__add {
  width: 100%;
  justify-content: center;
  margin-top: 4px;
}

.oauth__quota {
  margin-top: 8px;
  color: var(--md-on-surface-variant);
}

.oauth__retry {
  display: inline-flex;
  justify-content: center;
  margin-top: 12px;
  text-decoration: none;
}

.oauth__spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid var(--md-primary);
  border-top-color: transparent;
  border-radius: var(--md-radius-full);
  animation: oauth-spin 0.8s linear infinite;
  flex: none;
}

@keyframes oauth-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
