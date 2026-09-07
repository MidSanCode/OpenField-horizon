<script setup lang="ts">
/**
 * Post detail: the post itself plus its reply thread. Public read (crawlable
 * reply content is part of the SEO surface); replying requires sign-in.
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useSnackbarStore } from '@/stores/snackbar'
import { t } from '@/i18n'
import { useSeo, watchSeo } from '@/composables/seo'
import type { Post, Reply } from '@/types'
import PostCard from '@/components/PostCard.vue'
import AuthorLine from '@/components/AuthorLine.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const snackbar = useSnackbarStore()

const post = ref<Post | null>(null)
const replies = ref<Reply[]>([])
const loading = ref(false)
const failed = ref(false)
const draft = ref('')
const sending = ref(false)

const postId = computed(() => route.params.id as string)

useSeo({ title: '帖子 · 地平线 Horizon' })
watchSeo(() =>
  post.value
    ? {
        title: `${post.value.nickname || post.value.username || 'User'} 的帖子 · 地平线 Horizon`,
        description: post.value.content.slice(0, 120),
      }
    : null,
)

async function load() {
  loading.value = true
  failed.value = false
  try {
    const [postRes, replyRes] = await Promise.all([api.getPost(postId.value), api.getReplies(postId.value)])
    post.value = postRes
    replies.value = replyRes.replies ?? []
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

async function send() {
  if (!auth.isAuthenticated) {
    snackbar.show(t('loginRequired'))
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  if (!draft.value.trim()) return
  sending.value = true
  try {
    await api.createReply(postId.value, draft.value.trim())
    draft.value = ''
    void load()
  } catch (e) {
    snackbar.show(String(e))
  } finally {
    sending.value = false
  }
}

onMounted(() => void load())
</script>

<template>
  <div class="page">
    <div v-if="failed" class="empty">
      <p>{{ t('notFound') }}</p>
      <RouterLink to="/" class="m3-tonal-button">{{ t('navHome') }}</RouterLink>
  </div>

    <template v-if="post">
      <PostCard :post="post" @changed="load" />

      <section aria-label="回复" class="replies">
        <h2 class="replies__title">{{ t('reply') }} · {{ post.reply_count }}</h2>

        <div v-for="r in replies" :key="r.id" class="m3-card reply">
          <header class="reply__head">
            <AuthorLine :author="r" />
            <span class="m3-label-small">{{ new Date(r.created_at).toLocaleString() }}</span>
          </header>
          <div v-if="r.reply_to_name" class="reply__quote m3-label-small">
            ↩ @{{ r.reply_to_name }}: {{ (r.reply_to_content ?? '').slice(0, 80) }}
          </div>
          <p class="reply__body">{{ r.content }}</p>
        </div>

        <p v-if="replies.length === 0" class="m3-label-small" style="text-align:center">—</p>

        <div class="m3-card reply-composer">
          <textarea
            v-model="draft"
            class="m3-input"
            rows="3"
            :placeholder="t('createReply')"
          />
          <div class="reply-composer__actions">
            <button class="m3-filled-button" :disabled="sending || !draft.trim()" @click="send">
              {{ t('createReply') }}
            </button>
          </div>
        </div>
      </section>
    </template>

    <p v-if="loading" class="m3-label-small" style="text-align:center">…</p>
  </div>
</template>

<style scoped>
.replies {
  margin-top: 18px;
}

.replies__title {
  font-size: 17px;
  margin: 0 0 10px;
}

.reply__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.reply__quote {
  background: var(--md-surface-container-high);
  border-radius: var(--md-radius-xs);
  padding: 6px 10px;
  margin-bottom: 6px;
}

.reply__body {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.reply-composer__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.empty {
  text-align: center;
  color: var(--md-on-surface-variant);
  padding: 32px 0;
}
</style>
