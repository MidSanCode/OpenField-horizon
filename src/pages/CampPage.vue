<script setup lang="ts">
/**
 * Camp detail: camp metadata, join/leave, and the camp-scoped post feed.
 * Camp posts are plain posts filtered server-side, so PostCard works as-is.
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/api'
import { ApiError } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useSnackbarStore } from '@/stores/snackbar'
import { t } from '@/i18n'
import { useSeo, watchSeo } from '@/composables/seo'
import type { Camp, Post } from '@/types'
import PostCard from '@/components/PostCard.vue'

const route = useRoute()
const auth = useAuthStore()
const snackbar = useSnackbarStore()

const camp = ref<Camp | null>(null)
const posts = ref<Post[]>([])
const loading = ref(false)
const failed = ref(false)
/** True when the members-only feed answered 403 — show a join hint. */
const membersOnly = ref(false)

const campId = computed(() => route.params.id as string)

useSeo({ title: '营地 · 地平线 Horizon' })
watchSeo(() => (camp.value ? { title: `${camp.value.name} · 营地 · 地平线 Horizon`, description: camp.value.description } : null))

async function load() {
  loading.value = true
  failed.value = false
  membersOnly.value = false
  try {
    // Camp metadata first (public); the feed may 403 for non-members.
    const campRes = await api.getCamp(campId.value)
    camp.value = campRes
    try {
      const postsRes = await api.getCampPosts(campId.value)
      posts.value = postsRes.posts ?? []
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        membersOnly.value = true
        posts.value = []
      } else {
        throw e
      }
    }
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

async function join() {
  if (!auth.isAuthenticated) {
    snackbar.show(t('loginRequired'))
    return
  }
  if (!camp.value) return
  try {
    await api.joinCamp(camp.value.id)
    snackbar.show(t('campJoined'))
    void load()
  } catch (e) {
    snackbar.show(String(e))
  }
}

async function leave() {
  if (!camp.value) return
  try {
    await api.leaveCamp(camp.value.id)
    void load()
  } catch (e) {
    snackbar.show(String(e))
  }
}

onMounted(() => void load())
</script>

<template>
  <div class="page">
    <div v-if="camp" class="m3-card m3-card--elevated head">
      <div class="head__row">
        <div>
          <h1 class="head__name">{{ camp.name }}</h1>
          <p class="head__desc">{{ camp.description || '—' }}</p>
          <p class="m3-label-small">
            {{ camp.member_count }} {{ t('campMembers') }} · {{ camp.post_count }} {{ t('campPosts') }}
            <span v-if="!camp.is_visible"> · 🔒</span>
            <span v-if="!camp.direct_join"> · {{ t('campInviteOnly') }}</span>
          </p>
        </div>
        <div class="head__actions">
          <button v-if="!camp.is_member" class="m3-filled-button" @click="join">{{ t('campJoin') }}</button>
          <button v-else-if="camp.creator_id !== auth.user?.id" class="m3-text-button" @click="leave">{{ t('unfollow') }}</button>
        </div>
      </div>
    </div>

    <p v-if="failed" class="empty">{{ t('loadFailed') }}</p>

    <div v-else-if="membersOnly" class="m3-card locked">
      <p class="locked__title">🔒 {{ t('campMembersOnly') }}</p>
      <button v-if="camp && !camp.is_member" class="m3-filled-button" @click="join">
        {{ t('campJoin') }}
      </button>
    </div>

    <template v-if="camp?.is_member">
      <div class="m3-card composer">
        <RouterLink :to="{ name: 'compose', query: { camp: camp.id } }" class="m3-filled-button">
          {{ t('createPost') }}
        </RouterLink>
      </div>
    </template>

    <PostCard v-for="p in posts" :key="p.id" :post="p" @changed="load" />

    <p v-if="!loading && camp && posts.length === 0" class="empty">{{ t('campPosts') }} · 0</p>
  </div>
</template>

<style scoped>
.head__row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.head__name {
  margin: 0 0 6px;
  font-size: 21px;
}

.head__desc {
  margin: 0 0 8px;
  color: var(--md-on-surface-variant);
}

.head__actions {
  display: flex;
  align-items: flex-start;
}

.composer {
  text-align: right;
}

.empty {
  text-align: center;
  color: var(--md-on-surface-variant);
  padding: 32px 0;
}

.locked {
  text-align: center;
  padding: 28px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.locked__title {
  margin: 0;
  color: var(--md-on-surface-variant);
}
</style>
