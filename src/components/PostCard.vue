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
import { useImagePlaceholder } from '@/composables/imageFallback'
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

// Markdown images come from v-html, where Vue cannot attach a listener; one
// delegated handler on the container swaps in the placeholder on failure.
const contentEl = ref<HTMLElement | null>(null)
useImagePlaceholder(contentEl)
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
/** Font Awesome icon classes per reaction type. */
const REACTION_ICONS: Record<string, string> = {
  like: 'fa-solid fa-thumbs-up',
  dislike: 'fa-regular fa-thumbs-down',
  love: 'fa-solid fa-heart',
  haha: 'fa-solid fa-face-laugh-squint',
  wow: 'fa-solid fa-face-surprise',
  sad: 'fa-solid fa-face-sad-tear',
  angry: 'fa-solid fa-face-angry',
}
</script>

<template>
  <article class="m3-card m3-card--elevated post">
    <div v-if="pinnedNow" class="m3-badge post__pin">
      <i class="fa-solid fa-thumbtack" aria-hidden="true"></i>
      {{ campScope ? t('campPinnedPost') : t('pinnedPost') }}
    </div>

    <header class="post__head">
      <AuthorLine :author="post" />
      <!-- The permalink sits on the timestamp rather than wrapping the body.
           Markdown output is block-level (headings, lists, tables) and can
           contain its own links, and an <a> inside the card's <a> makes the
           HTML parser run the adoption agency algorithm: it duplicates this
           anchor and hoists the markdown paragraph out of the card. A
           stretched link (see .post__time::after) keeps the whole card
           clickable without that. No aria-label: it would replace the visible
           timestamp as the accessible name. -->
      <RouterLink
        :to="`/posts/${post.id}`"
        class="m3-label-small post__time"
        :title="t('viewPost')"
      >{{ timeAgo(post.created_at) }}</RouterLink>
    </header>

    <div ref="contentEl" class="post__content md-body" v-html="html" />

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
          <i :class="REACTION_ICONS[r]" aria-hidden="true"></i><span v-if="(post.reactions?.[r] ?? 0) > 0">{{ post.reactions[r] }}</span>
        </button>
        <span v-if="reactionTotal === 0" class="m3-label-small">—</span>
      </div>
      <div class="post__meta">
        <button class="m3-text-button" @click="toggleFavorite">
          <i :class="post.is_favorite ? 'fa-solid fa-star' : 'fa-regular fa-star'" aria-hidden="true"></i>
          {{ post.favorite_count }}
        </button>
        <RouterLink :to="`/posts/${post.id}`" class="m3-text-button">
          <i class="fa-regular fa-comment" aria-hidden="true"></i> {{ post.reply_count }}
        </RouterLink>
        <template v-if="isMine">
          <button class="m3-text-button" @click="togglePinned" :title="pinnedNow ? t('unpinPost') : t('pinPost')">
            <i :class="pinnedNow ? 'fa-solid fa-thumbtack' : 'fa-regular fa-thumbtack'" aria-hidden="true"></i>
          </button>
          <button class="m3-text-button m3-text-button--danger" @click="remove">
            <i class="fa-regular fa-trash-can" aria-hidden="true"></i>
          </button>
        </template>
      </div>
    </footer>
  </article>
</template>

<style scoped>
.post {
  position: relative;
}

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

/**
 * Stretched link: the timestamp is the card's permalink and its ::after covers
 * the card, so clicking anywhere still opens the post. Anything genuinely
 * interactive is lifted above the overlay below, otherwise it would be
 * unreachable — but the permalink itself must stay unpositioned, because a
 * positioned anchor would become the containing block for its own ::after and
 * collapse the overlay down to the timestamp.
 */
.post__time {
  color: var(--md-on-surface-variant);
  text-decoration: none;
  white-space: nowrap;
}

.post__time:hover {
  text-decoration: underline;
}

.post__time::after {
  content: '';
  position: absolute;
  inset: 0;
}

.post :deep(a):not(.post__time),
.post :deep(button) {
  position: relative;
  z-index: 1;
}

.post__content {
  display: block;
  color: var(--md-on-surface);
  text-decoration: none;
}

/* The markdown element styles live in m3.css (.md-body), shared with the reply
   list; only the code-block chrome is card-specific. Heading margins are left
   to .md-body so its :first-child/:last-child rules keep working. */
.post__content :deep(code) {
  font-family: 'Cascadia Code', Consolas, monospace;
  background: var(--md-surface-container-high);
  border-radius: 4px;
  padding: 1px 5px;
}

.post__content :deep(pre) {
  background: var(--md-surface-container-high);
  border-radius: var(--md-radius-sm);
  padding: 12px;
  overflow-x: auto;
  font-size: 13px;
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
