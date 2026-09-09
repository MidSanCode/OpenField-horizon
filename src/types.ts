/**
 * API payload types for the OpenField gateway. Fields mirror the JSON keys
 * emitted by the Go services (snake_case); every optional field maps to a
 * value the server may omit for anonymous or degraded responses. Helpers at
 * the bottom derive display-ready views (image detection, author names) so
 * components never guess.
 */

export interface Attachment {
  id: number
  user_id?: number
  original_name: string
  mime_type: string
  size_bytes: number
  url: string
  thumb_url: string
  preview_url?: string
  created_at?: string
  visibility?: string
}

/** True when the attachment renders as an image (thumb/preview capable). */
export function isImageAttachment(a: Attachment): boolean {
  return a.mime_type.startsWith('image/')
}

/** Mid-size rendition chain: preview → thumbnail → original. */
export function attachmentDisplayUrl(a: Attachment): string {
  return a.preview_url || a.thumb_url || a.url
}

export interface AuthorFields {
  user_id?: number
  username?: string
  nickname?: string
  avatar_url?: string
  is_verified?: boolean
  is_bot?: boolean
  member_level?: number
  member_active?: boolean
}

export function authorName(a: AuthorFields): string {
  const name = a.nickname && a.nickname.length > 0 ? a.nickname : a.username
  return name && name.length > 0 ? name : 'Unknown'
}

export interface Post {
  id: number
  user_id: number
  content: string
  created_at: string
  updated_at: string
  username?: string
  nickname?: string
  avatar_url?: string
  is_verified?: boolean
  is_bot?: boolean
  member_level?: number
  member_active?: boolean
  attachments: Attachment[]
  reply_count: number
  view_count?: number
  favorite_count: number
  tip_total?: number
  visibility: string
  is_favorite?: boolean
  tags?: string[]
  reactions: Record<string, number>
  my_reaction?: string
  quoted_post_id?: number
  quoted_post?: Post | null
  pinned?: boolean
  camp_id?: number
  /** True when camp managers pinned this post within its camp feed. */
  camp_pinned?: boolean
}

export interface Reply {
  id: number
  post_id: number
  user_id: number
  content: string
  created_at: string
  username?: string
  nickname?: string
  avatar_url?: string
  is_verified?: boolean
  is_bot?: boolean
  member_level?: number
  member_active?: boolean
  reply_to_id?: number
  reply_to_name?: string
  reply_to_content?: string
  is_favorite?: boolean
}

export interface Camp {
  id: number
  name: string
  description: string
  creator_id: number
  creator_name?: string
  is_visible: boolean
  direct_join: boolean
  /** Whether plain members may post; false = owner/admins only. */
  member_post?: boolean
  /** Whether plain members may pin their own posts in the camp. */
  member_pin?: boolean
  member_count: number
  post_count: number
  is_member: boolean
  /** The viewer's camp role: owner/admin/member; absent for non-members. */
  my_role?: string
  created_at: string
  updated_at: string
}

export interface ProfileUser {
  id: number
  username: string
  nickname?: string
  bio?: string
  avatar_url?: string
  banner_url?: string
  is_verified?: boolean
  verified_note?: string
  follower_count?: number
  following_count?: number
  post_count?: number
  is_following?: boolean
  member_level?: number
  member_active?: boolean
  storage_quota?: number
  storage_used?: number
  exp?: number
  level?: number
}

export interface AuthUser extends ProfileUser {
  email?: string
  needs_registration?: boolean
  is_admin?: boolean
}

export interface Conversation {
  id: number
  type: 'private' | 'group'
  title?: string
  avatar_url?: string
  owner_id?: number
  is_public?: boolean
  allow_join?: boolean
  encrypted?: boolean
  member_count?: number
  is_member?: boolean
  unread?: number
  updated_at?: string
  last_message?: {
    id: number
    sender_id: number
    content: string
    kind?: string
    created_at: string
    sender_name?: string
  } | null
}

export interface ChatMessage {
  id: number
  conversation_id: number
  sender_id: number
  content: string
  kind?: string
  reply_to_id?: number
  reply_to_name?: string
  reply_to_content?: string
  created_at: string
  edited_at?: string | null
  deleted_at?: string | null
  sender_name?: string
  sender_avatar?: string
  attachments?: Attachment[]
}

export interface GroupAnnouncement {
  id: number
  conversation_id: number
  creator_id: number
  creator_name?: string
  title: string
  content: string
  created_at: string
}

export interface GroupTodo {
  id: number
  conversation_id: number
  creator_id: number
  creator_name?: string
  title: string
  done: boolean
  created_at: string
}

export interface GroupFile {
  message_id: number
  sender_id: number
  sender_name?: string
  created_at: string
  attachment: Attachment
}

export interface AppAnnouncement {
  id: number
  title: string
  content: string
  active: boolean
  created_at: string
}
