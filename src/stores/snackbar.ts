/**
 * Global snackbar queue. Components call snackbar.show(message) and the
 * App-level host renders the active message; avoids prop-drilling a toast
 * mechanism through every component.
 */
import { defineStore } from 'pinia'

let timer: ReturnType<typeof setTimeout> | null = null

export const useSnackbarStore = defineStore('snackbar', {
  state: () => ({
    message: '',
    visible: false,
  }),
  actions: {
    show(message: string, durationMs = 2800) {
      this.message = message
      this.visible = true
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        this.visible = false
      }, durationMs)
    },
  },
})
