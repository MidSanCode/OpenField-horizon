<script setup lang="ts">
/**
 * Author byline: avatar, display name, verification / membership badges.
 * Pure display; links to the profile when the author id is known.
 */
import { computed } from 'vue'
import { authorName, type AuthorFields } from '@/types'
import { useImageFallback } from '@/composables/imageFallback'

const props = defineProps<{
  author: AuthorFields
  /** Renders the name as a profile link (default true). */
  link?: boolean
}>()

const name = computed(() => authorName(props.author))
const profileHref = computed(() =>
  props.author.user_id ? `/u/${props.author.user_id}` : null,
)
const memberBadge = computed(() =>
  props.author.member_active && (props.author.member_level ?? 0) > 0
    ? `Lv.${props.author.member_level}`
    : null,
)

// An avatar that 404s falls back to the same initial as a missing one, rather
// than leaving the browser's broken-image glyph in the byline.
const avatarSrc = computed(() => props.author.avatar_url)
const { failed: avatarFailed, onError: onAvatarError } = useImageFallback(avatarSrc)
</script>

<template>
  <span class="author">
    <img
      v-if="avatarSrc && !avatarFailed"
      class="author__avatar"
      :src="avatarSrc"
      alt=""
      loading="lazy"
      @error="onAvatarError"
    />
    <span v-else class="author__avatar author__avatar--fallback">{{ name.slice(0, 1) }}</span>
    <span class="author__names">
      <RouterLink v-if="link && profileHref" :to="profileHref" class="author__name">{{ name }}</RouterLink>
      <span v-else class="author__name">{{ name }}</span>
      <span v-if="author.is_verified" class="author__verified" title="Verified">✔</span>
      <span v-if="author.is_bot" class="m3-chip">BOT</span>
      <span v-if="memberBadge" class="m3-badge">{{ memberBadge }}</span>
    </span>
  </span>
</template>

<style scoped>
.author {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.author__avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.author__avatar--fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--md-primary-container);
  color: var(--md-on-primary-container);
  font-weight: 700;
}

.author__names {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.author__name {
  font-weight: 600;
  color: var(--md-on-surface);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

a.author__name:hover {
  text-decoration: underline;
}

.author__verified {
  color: var(--md-primary);
  font-size: 13px;
}
</style>
