<script setup lang="ts">
/**
 * One feed post. Renders the full content (semantic <article> for crawlers)
 * with the shared attachment grid, the reaction bar, favorite/reply counts
 * and the owner actions (pin, delete). Interactions call the API directly
 * and emit `changed` so list owners can refresh or splice.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useSnackbarStore } from '@/stores/snackbar'
import { renderMarkdown } from '@/utils/markdown'
import { t } from '@/i18n'
import type { Post } from '@/types'
import AuthorLine from './AuthorLine.vue'
import AttachmentGrid from './AttachmentGrid.vue'

const props = defineProps<{ post: Post }>()
const emit = defineEmits<{ changed: [] }>()

const router = useRouter()
const auth = useAuthStore()
const snackbar = useSnackbarStore()

const busy = ref(false)

const html = computed(() => renderMarkdown(props.post.content))
const isMine = computed(() => auth.user?.id === props.post.user_id)
const reactionTotal = computed(() =>
  Object.values(props.post.reactions ?? {}).reduce((sum, n) => sum + n, 0),
)

/** Compact relative time for the byline. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return new Date(then).toISOString().slice(0, 10)
}

async function guard(): Promise<boolean> {
  if (!auth.isAuthenticated) {
    snackbar.show(t('loginRequired'))
    router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
    return false
  }
  return true
}

async function toggleFavorite() {
  if (!(await guard())) return
  try {
    if (props.post.is_favorite) await api.unfavorite(props.post.id)
    else await api.favorite(props.post.id)
    emit('changed')
  } catch (e) {
    snackbar.show(String(e))
  }
}

async function react(reaction: string) {
  if (!(await guard())) return
  try {
    if (props.post.my_reaction === reaction) await api.removeReaction(props.post.id)
    else await api.setReaction(props.post.id, reaction)
    emit('changed')
  } catch (e) {
    snackbar.show(String(e))
  }
}

/** Camp posts toggle the camp-scoped pin; global posts the profile pin. */
const campScope = computed(() => (props.post.camp_id ?? 0) > 0)
const pinnedNow = computed(() => (campScope.value ? props.post.camp_pinned : props.post.pinned) ?? false)

async function togglePinned() {
  try {
    await api.setPinned(props.post.id, !pinnedNow.value)
    snackbar.show(
      campScope.value
        ? (pinnedNow.value ? t('campUnpinPost') : t('campPinnedPost'))
        : (pinnedNow.value ? t('unpinPost') : t('pinnedPost')),
    )
    emit('changed')
  } catch (e) {
    snackbar.show(String(e))
  }
}

async function remove() {
  if (!window.confirm(t('confirmDeletePost'))) return
  try {
    await api.deletePost(props.post.id)
    snackbar.show(t('delete') + ' ✓')
    emit('changed')
  } catch (e) {
    snackbar.show(String(e))
  }
}

const REACTIONS = ['like', 'love', 'haha', 'wow', 'sad']
const REACTION_EMOJI: Record<string, string> = {
  like: '👍',
  dislike: '👎',
  love: '❤️',
  haha: '😂',
  wow: '😮',
  sad: '😢',
  angry: '😠',
}
</script>

<template>
  <article class="m3-card m3-card--elevated post">
    <div v-if="pinnedNow" class="m3-badge post__pin">📌 {{ campScope ? t('campPinnedPost') : t('pinnedPost') }}</div>

    <header class="post__head">
      <AuthorLine :author="post" />
      <span class="m3-label-small">{{ timeAgo(post.created_at) }}</span>
    </header>

    <RouterLink :to="`/posts/${post.id}`" class="post__content" v-html="html" />

    <AttachmentGrid :attachments="post.attachments ?? []" />

    <footer class="post__actions">
      <div class="post__reactions">
        <button
          v-for="r in REACTIONS"
          :key="r"
          class="m3-chip m3-chip--selectable"
          :class="{ 'm3-chip--active': post.my_reaction === r }"
          @click="react(r)"
        >
          {{ REACTION_EMOJI[r] }}<span v-if="(post.reactions?.[r] ?? 0) > 0">{{ post.reactions[r] }}</span>
        </button>
        <span v-if="reactionTotal === 0" class="m3-label-small">—</span>
      </div>
      <div class="post__meta">
        <button class="m3-text-button" @click="toggleFavorite">
          {{ post.is_favorite ? '★' : '☆' }} {{ post.favorite_count }}
        </button>
        <RouterLink :to="`/posts/${post.id}`" class="m3-text-button">💬 {{ post.reply_count }}</RouterLink>
        <template v-if="isMine">
          <button class="m3-text-button" @click="togglePinned">📌</button>
          <button class="m3-text-button m3-text-button--danger" @click="remove">🗑</button>
        </template>
      </div>
    </footer>
  </article>
</template>

<style scoped>
.post__pin {
  margin-bottom: 8px;
}

.post__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.post__content {
  display: block;
  color: var(--md-on-surface);
  text-decoration: none;
  overflow-wrap: anywhere;
}

.post__content:hover {
  text-decoration: none;
}

.post__content :deep(p) {
  margin: 0 0 8px;
}

.post__content :deep(blockquote) {
  margin: 8px 0;
  padding: 4px 14px;
  border-left: 3px solid var(--md-outline-variant);
  color: var(--md-on-surface-variant);
}

.post__content :deep(pre) {
  background: var(--md-surface-container-high);
  border-radius: var(--md-radius-sm);
  padding: 12px;
  overflow-x: auto;
  font-size: 13px;
}

.post__content :deep(code) {
  font-family: 'Cascadia Code', Consolas, monospace;
  background: var(--md-surface-container-high);
  border-radius: 4px;
  padding: 1px 5px;
}

.post__content :deep(pre code) {
  background: none;
  padding: 0;
}

.post__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.post__reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.post__meta {
  display: flex;
  gap: 2px;
  align-items: center;
}
</style>
