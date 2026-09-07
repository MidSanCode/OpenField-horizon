<script setup lang="ts">
/**
 * Attachment grid for a post: image attachments render as a tiled gallery
 * (preview-quality srcs) with lazy loading; non-image files render as chips.
 */
import { computed } from 'vue'
import { attachmentDisplayUrl, isImageAttachment, type Attachment } from '@/types'

const props = defineProps<{ attachments: Attachment[] }>()

const images = computed(() => props.attachments.filter(isImageAttachment))
const files = computed(() => props.attachments.filter((a) => !isImageAttachment(a)))

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <div v-if="images.length" class="grid" :class="`grid--${Math.min(images.length, 4)}`">
    <a
      v-for="att in images"
      :key="att.id"
      :href="att.url"
      target="_blank"
      rel="noopener"
      class="grid__item"
    >
      <img :src="attachmentDisplayUrl(att)" :alt="att.original_name" loading="lazy" />
    </a>
  </div>
  <div v-if="files.length" class="files">
    <a v-for="att in files" :key="att.id" :href="att.url" target="_blank" rel="noopener" class="m3-chip">
      📄 {{ att.original_name }} ({{ formatSize(att.size_bytes) }})
    </a>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}

.grid--1 {
  grid-template-columns: 1fr;
}

.grid--2 {
  grid-template-columns: 1fr 1fr;
}

.grid--3,
.grid--4 {
  grid-template-columns: 1fr 1fr;
}

.grid__item {
  display: block;
  border-radius: var(--md-radius-sm);
  overflow: hidden;
  background: var(--md-surface-container-high);
}

.grid__item img {
  display: block;
  width: 100%;
  max-height: 420px;
  object-fit: cover;
}

.files {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
</style>
