/**
 * Typed endpoint catalog for the OpenField gateway. Methods map 1:1 to the
 * server routes documented in the server repo's docs/API.md; public reads
 * pass auth:false so anonymous crawlers render the same content.
 */
import { request } from './http'
import type {
  AppAnnouncement,
  Camp,
  ChatMessage,
  Conversation,
  GroupAnnouncement,
  GroupFile,
  GroupTodo,
  OAuthPickInfo,
  Post,
  ProfileUser,
  Reply,
} from '@/types'

/** AuthUser supplements ProfileUser for the signed-in self view. */
type AuthUser = ProfileUser

export interface LoginResult {
  access_token: string
  refresh_token?: string
  expires_in?: number
  refresh_expires_in?: number
  user: ProfileUser
}

/**
 * How the OIDC callback should finish. `web` makes the server bounce back to
 * the browser client (`oidc.web_redirect_url`) instead of firing the
 * `openfield://` deep link, which browsers refuse to open silently.
 */
export type OAuthFlow = 'web' | 'app'

export const api = {
  // ---- auth ----
  login: (username: string, password: string) =>
    request<LoginResult>('/auth/login', { method: 'POST', body: { username, password }, auth: false }),

  /** Advertised sign-in methods: `["oidc", "password"]`. */
  providers: () => request<{ providers: string[] }>('/auth/providers', { auth: false }),

  /** Starts an OIDC login; the caller redirects the browser to `auth_url`. */
  oidcLogin: (flow: OAuthFlow = 'web') =>
    request<{ auth_url: string; provider: string; flow: string }>(
      `/auth/oidc/login?flow=${flow}`,
      { auth: false },
    ),

  /** Lists the accounts bound to a pick ticket (does not consume it). */
  oidcPick: (ticket: string) =>
    request<OAuthPickInfo>(`/auth/oidc/pick?ticket=${encodeURIComponent(ticket)}`, { auth: false }),

  /** Signs in as one of the accounts bound to the ticket (consumes it). */
  oidcPickSelect: (ticket: string, userId: number) =>
    request<LoginResult>('/auth/oidc/pick/select', {
      method: 'POST',
      body: { ticket, user_id: userId },
      auth: false,
    }),

  /** Provisions and signs into a new account for the ticket (consumes it). */
  oidcPickCreate: (ticket: string) =>
    request<LoginResult>('/auth/oidc/pick/create', {
      method: 'POST',
      body: { ticket },
      auth: false,
    }),

  refresh: (refreshToken: string) =>
    request<LoginResult>('/auth/refresh', { method: 'POST', body: { refresh_token: refreshToken }, auth: false }),

  register: (username: string, nickname: string, bio: string) =>
    request<ProfileUser>('/auth/register', { method: 'POST', body: { username, nickname, bio } }),

  me: () => request<AuthUser>('/users/me'),

  logout: () => request<void>('/auth/logout', { method: 'POST' }).catch(() => undefined),

  // ---- posts ----
  getPosts: (page = 1, limit = 20) =>
    request<{ posts: Post[] }>(`/posts?page=${page}&limit=${limit}`, { auth: false }),

  getPost: (id: number | string) => request<Post>(`/posts/${id}`, { auth: false }),

  getReplies: (id: number | string) =>
    request<{ replies: Reply[] }>(`/posts/${id}/replies`, { auth: false }),

  createPost: (content: string, visibility = 'public', campId = 0) =>
    request<Post>('/posts', {
      method: 'POST',
      body: { content, visibility, ...(campId > 0 ? { camp_id: campId } : {}) },
    }),

  deletePost: (id: number) => request<void>(`/posts/${id}`, { method: 'DELETE' }),

  setPinned: (id: number, pinned: boolean) =>
    request<void>(`/posts/${id}/pin`, { method: 'PUT', body: { pinned } }),

  setReaction: (id: number, reaction: string) =>
    request<void>(`/posts/${id}/reactions`, { method: 'PUT', body: { reaction } }),

  removeReaction: (id: number) => request<void>(`/posts/${id}/reactions`, { method: 'DELETE' }),

  favorite: (id: number) => request<void>(`/posts/${id}/favorite`, { method: 'POST' }),

  unfavorite: (id: number) => request<void>(`/posts/${id}/favorite`, { method: 'DELETE' }),

  createReply: (postId: number | string, content: string) =>
    request<Reply>(`/posts/${postId}/replies`, { method: 'POST', body: { content } }),

  // ---- camps ----
  // Camp reads carry the token when present (http.ts skips the header for
  // anonymous visitors): the server personalizes is_member/my_role, and
  // without it joined camps would forever show a "join" button.
  listCamps: (query = '', mine = false) => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (mine) params.set('mine', '1')
    const qs = params.toString()
    return request<{ camps: Camp[] }>(`/camps${qs ? `?${qs}` : ''}`)
  },

  getCamp: (id: number | string) => request<Camp>(`/camps/${id}`),

  getCampPosts: (id: number | string) =>
    request<{ posts: Post[] }>(`/camps/${id}/posts?limit=50`),

  createCamp: (name: string, description: string, isVisible: boolean, directJoin: boolean) =>
    request<Camp>('/camps', {
      method: 'POST',
      body: { name, description, is_visible: isVisible, direct_join: directJoin },
    }),

  joinCamp: (id: number) => request<{ status: string }>(`/camps/${id}/join`, { method: 'POST' }),

  leaveCamp: (id: number) => request<void>(`/camps/${id}/members/me`, { method: 'DELETE' }),

  setCampAnnouncement: (id: number, announcement: string) =>
    request<Camp>(`/camps/${id}/announcement`, { method: 'PUT', body: { announcement } }),

  // ---- users ----
  getUser: (id: number | string) => request<ProfileUser>(`/users/${id}`, { auth: false }),

  getUserPosts: (id: number | string) =>
    request<{ posts: Post[] }>(`/users/${id}/posts?limit=50`, { auth: false }),

  follow: (id: number) => request<void>(`/users/${id}/follow`, { method: 'POST' }),

  unfollow: (id: number) => request<void>(`/users/${id}/follow`, { method: 'DELETE' }),

  // ---- app announcements ----
  announcements: () =>
    request<{ announcements: AppAnnouncement[] }>('/announcements', { auth: false }),

  // ---- chat ----
  conversations: () => request<{ conversations: Conversation[] }>('/conversations'),

  conversation: (id: number | string) => request<Conversation>(`/conversations/${id}`),

  messages: (id: number | string, before = 0) =>
    request<{ messages: ChatMessage[] }>(
      `/conversations/${id}/messages?limit=50${before > 0 ? `&before=${before}` : ''}`,
    ),

  sendMessage: (id: number, content: string) =>
    request<ChatMessage>(`/conversations/${id}/messages`, { method: 'POST', body: { content } }),

  markRead: (id: number | string) => request<void>(`/conversations/${id}/read`, { method: 'POST' }),

  // ---- group extras ----
  groupAnnouncements: (id: number | string) =>
    request<{ announcements: GroupAnnouncement[] }>(`/conversations/${id}/announcements`),

  groupTodos: (id: number | string) =>
    request<{ todos: GroupTodo[] }>(`/conversations/${id}/todos`),

  setTodoDone: (convId: number | string, todoId: number, done: boolean) =>
    request<void>(`/conversations/${convId}/todos/${todoId}`, { method: 'PUT', body: { done } }),

  groupFiles: (id: number | string) =>
    request<{ files: GroupFile[] }>(`/conversations/${id}/files`),
}
