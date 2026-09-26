/**
 * Route table. Public content routes (feed, posts, camps, profiles,
 * announcements) carry index-follow meta for crawlers; private surfaces
 * (settings, chat, composer) are noindex and auth-gated.
 */
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { readAccessToken } from '@/api/http'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('@/pages/HomePage.vue'), meta: { title: '广场 · 地平线 Horizon' } },
  { path: '/posts/:id', name: 'post', component: () => import('@/pages/PostPage.vue'), meta: { title: '帖子 · 地平线 Horizon' } },
  { path: '/camps', name: 'camps', component: () => import('@/pages/CampsPage.vue'), meta: { title: '营地 · 地平线 Horizon' } },
  { path: '/camps/:id', name: 'camp', component: () => import('@/pages/CampPage.vue'), meta: { title: '营地 · 地平线 Horizon' } },
  { path: '/u/:id', name: 'user', component: () => import('@/pages/UserPage.vue'), meta: { title: '用户 · 地平线 Horizon' } },
  { path: '/announcements', name: 'announcements', component: () => import('@/pages/AnnouncementsPage.vue'), meta: { title: '公告 · 地平线 Horizon' } },
  { path: '/login', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { title: '登录 · 地平线 Horizon', noindex: true } },
  // OAuth landing route: the server redirects here with tokens (or a pick
  // ticket) in the query string, so it must stay public and must never be
  // cached by a crawler or an intermediary.
  { path: '/oauth/callback', name: 'oauth-callback', component: () => import('@/pages/OAuthCallbackPage.vue'), meta: { title: '登录中 · 地平线 Horizon', noindex: true } },
  { path: '/compose', name: 'compose', component: () => import('@/pages/ComposerPage.vue'), meta: { title: '发帖 · 地平线 Horizon', noindex: true, requiresAuth: true } },
  { path: '/chat', name: 'chat', component: () => import('@/pages/ChatPage.vue'), meta: { title: '聊天 · 地平线 Horizon', noindex: true, requiresAuth: true } },
  { path: '/chat/:id', name: 'conversation', component: () => import('@/pages/ConversationPage.vue'), meta: { title: '会话 · 地平线 Horizon', noindex: true, requiresAuth: true } },
  { path: '/settings', name: 'settings', component: () => import('@/pages/SettingsPage.vue'), meta: { title: '设置 · 地平线 Horizon', noindex: true } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue'), meta: { title: '404 · 地平线 Horizon', noindex: true } },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

/**
 * Auth gate: unauthenticated users hitting a protected route are bounced to
 * the login page with a redirect target; the meta is applied per navigation.
 */
router.beforeEach((to) => {
  if (to.meta.requiresAuth && !readAccessToken()) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
})

/** Keeps the document title in sync with the active route. */
router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  if (title) document.title = title
  let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
  if (to.meta.noindex) {
    if (!robots) {
      robots = document.createElement('meta')
      robots.setAttribute('name', 'robots')
      document.head.appendChild(robots)
    }
    robots.setAttribute('content', 'noindex, nofollow')
  } else if (robots) {
    robots.remove()
  }
})
