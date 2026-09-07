<script setup lang="ts">
/**
 * Announcement history page. Public read so links from the startup dialog
 * work for signed-out visitors too.
 */
import { onMounted, ref } from 'vue'
import { api } from '@/api'
import type { AppAnnouncement } from '@/types'
import { t } from '@/i18n'
import { useSeo } from '@/composables/seo'

useSeo({
  title: '公告 · 地平线 Horizon',
  description: 'OpenField 平台公告与更新记录。',
})

const announcements = ref<AppAnnouncement[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await api.announcements()
    announcements.value = res.announcements ?? []
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page">
    <h1 class="page-title">{{ t('announcements') }}</h1>

    <article v-for="a in announcements" :key="a.id" class="m3-card m3-card--elevated">
      <header class="ann__head">
        <h2 class="ann__title">{{ a.title }}</h2>
        <time class="m3-label-small" :datetime="a.created_at">{{ new Date(a.created_at).toLocaleDateString() }}</time>
      </header>
      <p class="ann__body">{{ a.content }}</p>
    </article>

    <p v-if="!loading && announcements.length === 0" class="empty">{{ t('announcementsEmpty') }}</p>
  </div>
</template>

<style scoped>
.page-title {
  font-size: 22px;
  margin: 4px 0 16px;
}

.ann__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
}

.ann__title {
  margin: 0;
  font-size: 17px;
}

.ann__body {
  margin: 8px 0 0;
  white-space: pre-wrap;
  color: var(--md-on-surface-variant);
}

.empty {
  text-align: center;
  color: var(--md-on-surface-variant);
  padding: 32px 0;
}
</style>
