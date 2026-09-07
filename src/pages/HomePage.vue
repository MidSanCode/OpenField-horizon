<script setup lang="ts">
/**
 * Public feed page — the SEO landing surface. Renders published posts as
 * semantic <article> elements (via PostCard) with pagination; anonymous
 * crawlers see the same content because reads are unauthenticated.
 */
import { onMounted, ref } from 'vue'
import { api } from '@/api'
import type { Post } from '@/types'
import { t } from '@/i18n'
import { useSeo } from '@/composables/seo'
import PostCard from '@/components/PostCard.vue'

useSeo({
  title: '广场 · 地平线 Horizon',
  description: 'OpenField 社区公开动态：帖子、讨论与分享。',
})

const posts = ref<Post[]>([])
const page = ref(1)
const loading = ref(false)
const done = ref(false)

async function load(next: boolean) {
  if (loading.value) return
  loading.value = true
  try {
    const res = await api.getPosts(page.value)
    const list = res.posts ?? []
    posts.value = next ? [...posts.value, ...list] : list
    if (list.length < 20) done.value = true
  } catch {
    // Errors surface as an empty feed; retry affordance stays visible.
  } finally {
    loading.value = false
  }
}

function reload() {
  page.value = 1
  void load(false)
}

onMounted(() => void load(false))
</script>

<template>
  <div class="page">
    <h1 class="page-title">{{ t('navHome') }}</h1>

    <PostCard v-for="p in posts" :key="p.id" :post="p" @changed="reload" />

    <div v-if="!loading && posts.length === 0" class="empty">
      <p>{{ t('loadFailed') }}</p>
      <button class="m3-tonal-button" @click="reload">{{ t('retry') }}</button>
    </div>

    <button v-if="!done && posts.length > 0" class="m3-tonal-button load-more" :disabled="loading" @click="page++; load(true)">
      {{ loading ? '…' : t('retry') === '' ? '' : '•••' }}
    </button>
  </div>
</template>

<style scoped>
.page-title {
  font-size: 22px;
  margin: 4px 0 16px;
}

.empty {
  text-align: center;
  color: var(--md-on-surface-variant);
  padding: 32px 0;
}

.load-more {
  display: block;
  margin: 8px auto 0;
}
</style>
