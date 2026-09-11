import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './styles/m3.css'

/**
 * Application entry: mounts the M3-styled SPA with pinia + vue-router. The
 * auth/settings stores bootstrap inside App.vue's setup so the first render
 * already reflects the restored session and theme.
 */
createApp(App).use(createPinia()).use(router).mount('#app')
