<script setup lang="ts">
/**
 * Public profile page: banner, avatar, name + badges, follow toggle, and the
 * user's posts (pinned ones arrive first from the server). Fully public for
 * crawlers; follow requires sign-in.
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useSnackbarStore } from '@/stores/snackbar'
import { t } from '@/i18n'
import { useSeo, watchSeo } from '@/composables/seo'
import { markdownToPlainText, renderMarkdown } from '@/utils/markdown'
import { useImageFallback, useImagePlaceholder } from '@/composables/imageFallback'
import type { Post, ProfileUser } from '@/types'
import PostCard from '@/components/PostCard.vue'

const route = useRoute()
const auth = useAuthStore()
const snackbar = useSnackbarStore()

const user = ref<ProfileUser | null>(null)
const posts = ref<Post[]>([])
const loading = ref(false)
const failed = ref(false)

const userId = computed(() => route.params.id as string)
const isSelf = computed(() => auth.user?.id?.toString() === userId.value)

// A 404'd avatar falls back to the initial, like a missing one.
const avatarSrc = computed(() => user.value?.avatar_url)
const { failed: avatarFailed, onError: onAvatarError } = useImageFallback(avatarSrc)

// The bio is markdown (v-html), so its images need the delegated placeholder.
const bioEl = ref<HTMLElement | null>(null)
useImagePlaceholder(bioEl)

useSeo({ title: '用户 · 地平线 Horizon' })
watchSeo(() =>
  user.value
    ? {
        title: `${user.value.nickname || user.value.username} · 地平线 Horizon`,
        // The bio is markdown in the app; strip the syntax rather than leak
        // "#"/"**" into the meta description.
        description: user.value.bio ? markdownToPlainText(user.value.bio) : undefined,
      }
    : null,
)

async function load() {
  loading.value = true
  failed.value = false
  try {
    const [userRes, postsRes] = await Promise.all([
      api.getUser(userId.value),
      api.getUserPosts(userId.value),
    ])
    user.value = userRes
    posts.value = postsRes.posts ?? []
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

async function toggleFollow() {
  if (!auth.isAuthenticated) {
    snackbar.show(t('loginRequired'))
    return
  }
  if (!user.value) return
  try {
    if (user.value.is_following) await api.unfollow(user.value.id)
    else await api.follow(user.value.id)
    void load()
  } catch (e) {
    snackbar.show(String(e))
  }
}

onMounted(() => void load())
</script>

<template>
  <div class="page">
    <div v-if="user" class="m3-card head">
      <div class="head__banner" :style="user.banner_url ? { background: `url(${user.banner_url}) center/cover` } : {}" />
      <div class="head__row">
        <img
          v-if="avatarSrc && !avatarFailed"
          class="head__avatar"
          :src="avatarSrc"
          alt=""
          @error="onAvatarError"
        />
        <span v-else class="head__avatar head__avatar--fallback">{{ (user.nickname || user.username).slice(0, 1) }}</span>
        <div class="head__names">
          <h1 class="head__name">
            {{ user.nickname || user.username }}
            <span v-if="user.is_verified" title="Verified">✔</span>
            <span v-if="user.member_active && (user.member_level ?? 0) > 0" class="m3-badge">Lv.{{ user.member_level }}</span>
          </h1>
          <p class="m3-label-small">@{{ user.username }}</p>
          <p class="m3-label-small">
            {{ user.follower_count ?? 0 }} {{ t('followers') }} ·
            {{ user.following_count ?? 0 }} {{ t('following') }} ·
            {{ user.post_count ?? 0 }} {{ t('posts') }}
          </p>
        </div>
        <div class="head__actions">
          <button
            v-if="!isSelf"
            class="m3-filled-button"
            :class="{ 'm3-tonal-button': user.is_following }"
            @click="toggleFollow"
          >
            {{ user.is_following ? t('unfollow') : t('follow') }}
          </button>
          <RouterLink v-else :to="{ name: 'settings' }" class="m3-text-button">{{ t('settings') }}</RouterLink>
        </div>
      </div>

      <!-- The bio is markdown (MarkdownContent in the app's profile_page.dart)
           and markdown output is block-level, so it gets its own block below
           the name row rather than being appended to the @handle line. -->
      <div v-if="user.bio" ref="bioEl" class="head__bio md-body" v-html="renderMarkdown(user.bio)" />
    </div>

    <p v-if="failed" class="empty">{{ t('loadFailed') }}</p>

    <PostCard v-for="p in posts" :key="p.id" :post="p" @changed="load" />

    <p v-if="!loading && user && posts.length === 0" class="empty">{{ t('posts') }} · 0</p>
  </div>
</template>

<style scoped>
.head {
  padding: 0;
  overflow: hidden;
}

.head__banner {
  height: 110px;
  background: linear-gradient(135deg, var(--md-primary-container), var(--md-secondary-container));
}

.head__row {
  display: flex;
  gap: 14px;
  padding: 0 16px 16px;
  margin-top: -34px;
  align-items: flex-end;
}

.head__avatar {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  border: 3px solid var(--md-surface-container);
  object-fit: cover;
}

.head__avatar--fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--md-primary-container);
  color: var(--md-on-primary-container);
  font-weight: 700;
}

.head__names {
  flex: 1;
  min-width: 0;
}

.head__name {
  margin: 0;
  font-size: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.head__actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* The bio sits below the name row, separated the way the app's profile page
   separates it with a divider. */
.head__bio {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--md-outline-variant);
  font-size: 14px;
}

.empty {
  text-align: center;
  color: var(--md-on-surface-variant);
  padding: 32px 0;
}
</style>
