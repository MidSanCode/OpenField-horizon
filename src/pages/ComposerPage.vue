<script setup lang="ts">
/**
 * Post composer. Camps may scope the post via ?camp=<id>; visibility choices
 * mirror the Flutter client's scopes. Attachments are not wired yet (see the
 * Horizon README limitations section).
 */
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api'
import { useSnackbarStore } from '@/stores/snackbar'
import { t } from '@/i18n'
import { useSeo } from '@/composables/seo'
import type { Camp } from '@/types'

useSeo({ title: '发帖 · 地平线 Horizon' })

const route = useRoute()
const router = useRouter()
const snackbar = useSnackbarStore()

const content = ref('')
const visibility = ref('public')
const campId = ref(Number(route.query.camp ?? 0) || 0)
const campName = ref('')
const busy = ref(false)

const visibilities = [
  { value: 'public', label: t('visibilityPublic') },
  { value: 'login', label: t('visibilityLogin') },
  { value: 'friends', label: t('visibilityFriends') },
]

onMounted(async () => {
  if (campId.value > 0) {
    try {
      const camp = await api.getCamp(campId.value)
      campName.value = camp.name
    } catch {
      campId.value = 0
    }
  }
})

async function submit() {
  if (!content.value.trim()) return
  busy.value = true
  try {
    await api.createPost(content.value.trim(), visibility.value, campId.value)
    snackbar.show(t('postSuccess'))
    await router.replace(campId.value > 0 ? `/camps/${campId.value}` : '/')
  } catch (e) {
    snackbar.show(String(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">{{ t('postComposerTitle') }}</h1>
    <p v-if="campName" class="m3-chip">🏕️ {{ campName }}</p>

    <textarea
      v-model="content"
      class="m3-input composer__input"
      rows="8"
      :placeholder="t('postComposerPlaceholder')"
    />

    <div class="composer__row">
      <label class="composer__visibility">
        <span class="m3-label-small">{{ t('visibility') }}</span>
        <select v-model="visibility" class="m3-input">
          <option v-for="v in visibilities" :key="v.value" :value="v.value">{{ v.label }}</option>
        </select>
      </label>
      <button class="m3-filled-button" :disabled="busy || !content.trim()" @click="submit">
        {{ busy ? '…' : t('createPost') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.page-title {
  font-size: 22px;
  margin: 4px 0 16px;
}

.composer__input {
  font: inherit;
  resize: vertical;
}

.composer__row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
}

.composer__visibility {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 180px;
}
</style>
