<script setup lang="ts">
/**
 * Conversation list. Signed-in only (router-guarded); unread counts and the
 * last message preview come straight from the server payload.
 */
import { onMounted, ref } from 'vue'
import { api } from '@/api'
import type { Conversation } from '@/types'
import { t } from '@/i18n'
import { useSeo } from '@/composables/seo'

useSeo({ title: '聊天 · 地平线 Horizon' })

const conversations = ref<Conversation[]>([])
const loading = ref(true)
const failed = ref(false)

onMounted(async () => {
  try {
    const res = await api.conversations()
    conversations.value = res.conversations ?? []
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})

/** Preview text: group chats carry titles; private ones show the peer via
 * the conversation title fallback the server already resolves. */
function preview(c: Conversation): string {
  const last = c.last_message
  if (!last) return '—'
  const prefix = c.type === 'group' && last.sender_name ? `${last.sender_name}: ` : ''
  return prefix + last.content.slice(0, 60)
}

function timeLabel(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) {
    return d.toTimeString().slice(0, 5)
  }
  return d.toISOString().slice(0, 10)
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">{{ t('navChat') }}</h1>

    <RouterLink v-for="c in conversations" :key="c.id" :to="`/chat/${c.id}`" class="m3-card m3-card--elevated conv">
      <span class="conv__avatar">{{ c.type === 'group' ? '👥' : '👤' }}</span>
      <span class="conv__main">
        <span class="conv__title">
          {{ c.title || (c.type === 'group' ? `Group #${c.id}` : `Chat #${c.id}`) }}
        </span>
        <span class="conv__preview">{{ preview(c) }}</span>
      </span>
      <span class="conv__meta">
        <span class="m3-label-small">{{ timeLabel(c.last_message?.created_at ?? c.updated_at) }}</span>
        <span v-if="(c.unread ?? 0) > 0" class="conv__unread">{{ c.unread }}</span>
      </span>
    </RouterLink>

    <p v-if="!loading && conversations.length === 0" class="empty">{{ t('chatEmpty') }}</p>
    <p v-if="failed" class="empty">{{ t('loadFailed') }}</p>
  </div>
</template>

<style scoped>
.page-title {
  font-size: 22px;
  margin: 4px 0 16px;
}

.conv {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: var(--md-on-surface);
}

.conv:hover {
  text-decoration: none;
  box-shadow: var(--md-elev-1);
}

.conv__avatar {
  font-size: 24px;
}

.conv__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.conv__title {
  font-weight: 600;
}

.conv__preview {
  font-size: 13px;
  color: var(--md-on-surface-variant);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.conv__unread {
  background: var(--md-primary);
  color: var(--md-on-primary);
  border-radius: var(--md-radius-full);
  font-size: 11px;
  min-width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

.empty {
  text-align: center;
  color: var(--md-on-surface-variant);
  padding: 32px 0;
}
</style>
