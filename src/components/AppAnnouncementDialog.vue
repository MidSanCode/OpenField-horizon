<script setup lang="ts">
/**
 * Startup app-announcement dialog. Fetches the server's active announcements
 * once, skips ones the user dismissed permanently (localStorage set), and
 * renders the newest pending notice with "don't show again" / history links.
 * Entirely best-effort: failures are silent so the app is never blocked.
 */
import { onMounted, ref } from 'vue'
import { api } from '@/api'
import type { AppAnnouncement } from '@/types'
import { t } from '@/i18n'

const DISMISSED_KEY = 'horizon.dismissedAnnouncements'

const announcement = ref<AppAnnouncement | null>(null)

onMounted(async () => {
  try {
    const res = await api.announcements()
    const dismissed = new Set(
      (JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]') as number[]) ?? [],
    )
    announcement.value = res.announcements.find((a) => !dismissed.has(a.id)) ?? null
  } catch {
    // Best-effort only.
  }
})

function dismiss() {
  if (!announcement.value) return
  try {
    const dismissed = new Set(
      (JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]') as number[]) ?? [],
    )
    dismissed.add(announcement.value.id)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]))
  } catch {
    // Corrupt storage is treated as empty on the next load.
  }
  announcement.value = null
}
</script>

<template>
  <div v-if="announcement" class="m3-dialog-backdrop" @click.self="announcement = null">
    <div class="m3-dialog" role="dialog" aria-modal="true">
      <h3>📣 {{ announcement.title }}</h3>
      <p class="m3-body-medium" style="white-space: pre-wrap">{{ announcement.content }}</p>
      <div class="m3-dialog__actions">
        <button class="m3-text-button" @click="dismiss">{{ t('announcementDontShow') }}</button>
        <RouterLink to="/announcements" class="m3-text-button">{{ t('announcements') }}</RouterLink>
        <button class="m3-filled-button" @click="announcement = null">{{ t('close') }}</button>
      </div>
    </div>
  </div>
</template>
