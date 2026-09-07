<script setup lang="ts">
/**
 * Camp directory: searchable list of visible camps with a mine/all toggle
 * and a create-camp dialog. Membership actions (join/leave) are inline.
 */
import { onMounted, ref } from 'vue'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useSnackbarStore } from '@/stores/snackbar'
import { t } from '@/i18n'
import { useSeo } from '@/composables/seo'
import type { Camp } from '@/types'

useSeo({
  title: '营地 · 地平线 Horizon',
  description: 'OpenField 营地：按兴趣聚拢的社区空间，发帖、讨论、同好交流。',
})

const auth = useAuthStore()
const snackbar = useSnackbarStore()

const camps = ref<Camp[]>([])
const query = ref('')
const mine = ref(false)
const loading = ref(false)

const showCreate = ref(false)
const newName = ref('')
const newDesc = ref('')
const newVisible = ref(true)
const newDirectJoin = ref(true)

async function load() {
  loading.value = true
  try {
    const res = await api.listCamps(query.value, mine.value && auth.isAuthenticated)
    camps.value = res.camps ?? []
  } catch (e) {
    snackbar.show(String(e))
  } finally {
    loading.value = false
  }
}

function toggleMine() {
  if (mine.value && !auth.isAuthenticated) {
    snackbar.show(t('loginRequired'))
    return
  }
  mine.value = !mine.value
  void load()
}

async function join(camp: Camp) {
  if (!auth.isAuthenticated) {
    snackbar.show(t('loginRequired'))
    return
  }
  try {
    await api.joinCamp(camp.id)
    snackbar.show(t('campJoined'))
    void load()
  } catch (e) {
    snackbar.show(String(e))
  }
}

async function create() {
  if (!newName.value.trim()) return
  try {
    await api.createCamp(newName.value.trim(), newDesc.value.trim(), newVisible.value, newDirectJoin.value)
    showCreate.value = false
    newName.value = ''
    newDesc.value = ''
    snackbar.show(t('campCreate') + ' ✓')
    void load()
  } catch (e) {
    snackbar.show(String(e))
  }
}

onMounted(() => void load())
</script>

<template>
  <div class="page page--wide">
    <div class="toolbar">
      <h1 class="page-title">{{ t('navCamps') }}</h1>
      <button class="m3-filled-button" @click="showCreate = true">{{ t('campCreate') }}</button>
    </div>

    <div class="filters">
      <input v-model="query" class="m3-input" :placeholder="t('campSearchHint')" @keydown.enter="load" />
      <button class="m3-tonal-button" :class="{ 'm3-chip--active': mine }" @click="toggleMine">
        {{ mine ? t('campMine') : t('campAll') }}
      </button>
    </div>

    <div class="camp-grid">
      <article v-for="c in camps" :key="c.id" class="m3-card m3-card--elevated camp">
        <div class="camp__head">
          <h2 class="camp__name">
            <RouterLink :to="`/camps/${c.id}`">{{ c.name }}</RouterLink>
          </h2>
          <span v-if="!c.is_visible" class="m3-chip">🔒</span>
        </div>
        <p class="camp__desc">{{ c.description || '—' }}</p>
        <div class="camp__foot">
          <span class="m3-label-small">{{ c.member_count }} {{ t('campMembers') }} · {{ c.post_count }} {{ t('campPosts') }}</span>
          <span class="camp__actions">
            <RouterLink :to="`/camps/${c.id}`" class="m3-text-button">{{ t('campEnter') }}</RouterLink>
            <button v-if="!c.is_member" class="m3-tonal-button" @click="join(c)">{{ t('campJoin') }}</button>
          </span>
        </div>
      </article>
    </div>

    <p v-if="!loading && camps.length === 0" class="empty">{{ t('campEmpty') }}</p>

    <div v-if="showCreate" class="m3-dialog-backdrop" @click.self="showCreate = false">
      <div class="m3-dialog">
        <h3>{{ t('campCreate') }}</h3>
        <label class="field">
          <span>{{ t('campName') }}</span>
          <input v-model="newName" class="m3-input" />
        </label>
        <label class="field">
          <span>{{ t('campDescription') }}</span>
          <textarea v-model="newDesc" class="m3-input" rows="3" />
        </label>
        <label class="check">
          <input v-model="newVisible" type="checkbox" /> {{ t('campVisible') }}
        </label>
        <label class="check">
          <input v-model="newDirectJoin" type="checkbox" /> {{ t('campDirectJoin') }}
        </label>
        <div class="m3-dialog__actions">
          <button class="m3-text-button" @click="showCreate = false">{{ t('cancel') }}</button>
          <button class="m3-filled-button" :disabled="!newName.trim()" @click="create">{{ t('submit') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.page-title {
  font-size: 22px;
  margin: 4px 0 16px;
}

.filters {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.camp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.camp__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.camp__name {
  margin: 0;
  font-size: 17px;
}

.camp__name a {
  color: var(--md-on-surface);
}

.camp__desc {
  color: var(--md-on-surface-variant);
  font-size: 14px;
  margin: 8px 0 12px;
  min-height: 40px;
}

.camp__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.camp__actions {
  display: inline-flex;
  gap: 4px;
}

.empty {
  text-align: center;
  color: var(--md-on-surface-variant);
  padding: 32px 0;
}

.field {
  display: block;
  margin-bottom: 12px;
}

.field span {
  display: block;
  font-size: 13px;
  color: var(--md-on-surface-variant);
  margin-bottom: 4px;
}

.check {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 8px 0;
  font-size: 14px;
}
</style>
