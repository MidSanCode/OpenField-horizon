<script setup lang="ts">
/**
 * One conversation: message thread + composer, and the group extras drawer
 * (announcements / todos / files) for group chats. Web has no E2E key store, so
 * encrypted messages are shown as a locked placeholder rather than as
 * ciphertext: the envelope is detected per message, which keeps the thread
 * readable even when a conversation's `encrypted` flag disagrees with its
 * history (e.g. E2EE was switched off after encrypted messages were sent).
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/api'
import type { ChatMessage, Conversation, GroupAnnouncement, GroupFile, GroupTodo } from '@/types'
import { t } from '@/i18n'
import { useSeo } from '@/composables/seo'
import { useSnackbarStore } from '@/stores/snackbar'
import { isEncryptedEnvelope } from '@/utils/e2ee'

const route = useRoute()
const snackbar = useSnackbarStore()

/** A message plus the display flags derived once per load, so the template
 * never re-parses every payload on each render. */
interface DisplayMessage extends ChatMessage {
  /** The content is an E2EE envelope Horizon cannot decrypt. */
  locked: boolean
}

const conversation = ref<Conversation | null>(null)
const messages = ref<DisplayMessage[]>([])
const loading = ref(true)
const failed = ref(false)
const draft = ref('')
const sending = ref(false)
const threadEl = ref<HTMLElement | null>(null)

const extrasTab = ref<'none' | 'announcements' | 'todos' | 'files'>('none')
const extras = ref<{
  announcements: GroupAnnouncement[]
  todos: GroupTodo[]
  files: GroupFile[]
}>({ announcements: [], todos: [], files: [] })

const convId = computed(() => route.params.id as string)
const isGroup = computed(() => conversation.value?.type === 'group')

/** Number of undecryptable messages, used for the thread-level hint. */
const lockedCount = computed(() => messages.value.filter((m) => m.locked).length)

useSeo({ title: '会话 · 地平线 Horizon' })

function scrollToEnd() {
  void nextTick(() => {
    threadEl.value?.scrollTo({ top: threadEl.value.scrollHeight })
  })
}

/** Newest-last order with the encrypted flag resolved. */
function toDisplay(raw: ChatMessage[] | undefined): DisplayMessage[] {
  return (raw ?? [])
    .slice()
    .reverse()
    .map((m) => ({ ...m, locked: isEncryptedEnvelope(m.content ?? '') }))
}

async function load() {
  loading.value = true
  failed.value = false
  try {
    const [conv, msgs] = await Promise.all([
      api.conversation(convId.value),
      api.messages(convId.value),
    ])
    conversation.value = conv
    messages.value = toDisplay(msgs.messages)
    void api.markRead(convId.value)
    scrollToEnd()
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

async function send() {
  const content = draft.value.trim()
  if (!content) return
  sending.value = true
  try {
    await api.sendMessage(Number(convId.value), content)
    draft.value = ''
    const msgs = await api.messages(convId.value)
    messages.value = toDisplay(msgs.messages)
    scrollToEnd()
  } catch (e) {
    snackbar.show(String(e))
  } finally {
    sending.value = false
  }
}

async function toggleExtras(tab: 'announcements' | 'todos' | 'files') {
  extrasTab.value = extrasTab.value === tab ? 'none' : tab
  if (extrasTab.value === 'none') return
  try {
    if (tab === 'announcements') {
      const res = await api.groupAnnouncements(convId.value)
      extras.value.announcements = res.announcements ?? []
    } else if (tab === 'todos') {
      const res = await api.groupTodos(convId.value)
      extras.value.todos = res.todos ?? []
    } else {
      const res = await api.groupFiles(convId.value)
      extras.value.files = res.files ?? []
    }
  } catch (e) {
    snackbar.show(String(e))
  }
}

async function completeTodo(todo: GroupTodo) {
  await api.setTodoDone(convId.value, todo.id, !todo.done)
  todo.done = !todo.done
}

onMounted(() => void load())
</script>

<template>
  <div class="page conv-page">
    <div v-if="conversation" class="m3-card conv-head">
      <RouterLink to="/chat" class="m3-text-button">‹</RouterLink>
      <strong class="conv-head__title">
        {{ conversation.title || (isGroup ? `Group #${conversation.id}` : `Chat #${conversation.id}`) }}
      </strong>
      <template v-if="isGroup">
        <button
          class="m3-chip m3-chip--selectable"
          :class="{ 'm3-chip--active': extrasTab === 'announcements' }"
          @click="toggleExtras('announcements')"
        >
          <i class="fa-solid fa-bullhorn" aria-hidden="true"></i> {{ t('groupAnnouncements') }}
        </button>
        <button
          class="m3-chip m3-chip--selectable"
          :class="{ 'm3-chip--active': extrasTab === 'todos' }"
          @click="toggleExtras('todos')"
        >
          <i class="fa-regular fa-square-check" aria-hidden="true"></i> {{ t('groupTodos') }}
        </button>
        <button
          class="m3-chip m3-chip--selectable"
          :class="{ 'm3-chip--active': extrasTab === 'files' }"
          @click="toggleExtras('files')"
        >
          <i class="fa-solid fa-paperclip" aria-hidden="true"></i> {{ t('groupFiles') }}
        </button>
      </template>
    </div>

    <div v-if="conversation?.encrypted" class="m3-card encrypted-notice">
      🔐 {{ t('chatEncryptedNotice') }}
    </div>

    <!-- Only shown when the flag and the history disagree: a conversation that
         is no longer marked encrypted but still holds undecryptable messages. -->
    <p
      v-else-if="lockedCount > 0"
      class="m3-label-small encrypted-inline"
    >
      🔐 {{ t('chatEncryptedHistory', { count: lockedCount }) }}
    </p>

    <div v-if="extrasTab !== 'none'" class="m3-card extras">
      <template v-if="extrasTab === 'announcements'">
        <article v-for="a in extras.announcements" :key="a.id" class="extras__item">
          <strong>{{ a.title }}</strong>
          <p class="m3-body-medium">{{ a.content }}</p>
          <span class="m3-label-small">{{ a.creator_name }} · {{ new Date(a.created_at).toLocaleDateString() }}</span>
        </article>
        <p v-if="extras.announcements.length === 0" class="m3-label-small">—</p>
      </template>
      <template v-else-if="extrasTab === 'todos'">
        <label v-for="todo in extras.todos" :key="todo.id" class="extras__todo">
          <input type="checkbox" :checked="todo.done" @change="completeTodo(todo)" />
          <span :style="todo.done ? 'text-decoration: line-through; opacity: .6' : ''">{{ todo.title }}</span>
        </label>
        <p v-if="extras.todos.length === 0" class="m3-label-small">—</p>
      </template>
      <template v-else>
        <a
          v-for="f in extras.files"
          :key="f.message_id"
          class="extras__file"
          :href="f.attachment.url"
          target="_blank"
          rel="noopener"
        >
          📄 {{ f.attachment.original_name }}
          <span class="m3-label-small">{{ f.sender_name }} · {{ new Date(f.created_at).toLocaleDateString() }}</span>
        </a>
        <p v-if="extras.files.length === 0" class="m3-label-small">—</p>
      </template>
    </div>

    <div ref="threadEl" class="thread">
      <div v-for="m in messages" :key="m.id" class="msg" :class="{ 'msg--deleted': m.deleted_at }">
        <div v-if="m.kind && m.kind.startsWith('system')" class="msg__system m3-label-small">{{ m.content }}</div>
        <template v-else>
          <div class="msg__meta m3-label-small">
            {{ m.sender_name || `#${m.sender_id}` }} · {{ new Date(m.created_at).toLocaleTimeString() }}
          </div>
          <!-- Never print an E2EE envelope: web cannot decrypt it, so show a
               lock placeholder instead of the raw base64 payload. -->
          <div v-if="m.locked" class="msg__bubble msg__bubble--locked" :title="t('chatEncryptedMessage')">
            <i class="fa-solid fa-lock" aria-hidden="true"></i>
            <span>{{ t('chatEncryptedMessage') }}</span>
          </div>
          <div v-else class="msg__bubble">{{ m.content }}</div>
        </template>
      </div>
      <p v-if="!loading && messages.length === 0" class="m3-label-small" style="text-align:center">—</p>
      <p v-if="failed" class="empty">{{ t('loadFailed') }}</p>
    </div>

    <div v-if="!conversation?.encrypted" class="composer">
      <input v-model="draft" class="m3-input" :placeholder="t('chatSend')" @keydown.enter="send" />
      <button class="m3-filled-button" :disabled="sending || !draft.trim()" @click="send">
        {{ t('chatSend') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.conv-page {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 140px);
}

.conv-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 14px;
}

.conv-head__title {
  margin-right: auto;
}

.encrypted-notice {
  background: var(--md-tertiary-container);
  color: var(--md-on-tertiary-container);
}

.extras {
  max-height: 240px;
  overflow: auto;
}

.extras__item {
  border-bottom: 1px solid var(--md-outline-variant);
  padding: 8px 0;
}

.extras__todo {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 6px 0;
}

.extras__file {
  display: flex;
  flex-direction: column;
  padding: 8px 0;
  color: var(--md-on-surface);
}

.thread {
  flex: 1;
  overflow-y: auto;
  padding: 8px 2px;
}

.msg {
  margin-bottom: 10px;
}

.msg--deleted {
  opacity: 0.5;
}

.msg__system {
  text-align: center;
}

.msg__bubble {
  background: var(--md-surface-container-high);
  border-radius: var(--md-radius-md);
  padding: 9px 13px;
  display: inline-block;
  max-width: 78%;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* An E2EE message web cannot decrypt: muted, with the lock carrying the
   meaning so the row is never mistaken for ordinary text. */
.msg__bubble--locked {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-style: italic;
  color: var(--md-on-surface-variant);
  background: transparent;
  border: 1px dashed var(--md-outline, var(--md-on-surface-variant));
}

.encrypted-inline {
  color: var(--md-on-surface-variant);
  margin: 4px 0 8px;
}

.composer {
  position: sticky;
  bottom: 70px;
  display: flex;
  gap: 8px;
  background: var(--md-surface);
  padding: 8px 0;
}

.empty {
  text-align: center;
  color: var(--md-on-surface-variant);
  padding: 24px 0;
}
</style>
