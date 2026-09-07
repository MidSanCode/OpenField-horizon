<script setup lang="ts">
/**
 * 404 catch-all. Offers navigation back to the feed.
 */
import { t } from '@/i18n'
import { useSeo } from '@/composables/seo'

useSeo({ title: '404 · 地平线 Horizon' })
</script>

<template>
  <div class="page empty">
    <h1>404</h1>
    <p>{{ t('notFound') }}</p>
    <RouterLink to="/" class="m3-filled-button">{{ t('navHome') }}</RouterLink>
  </div>
</template>

<style scoped>
.empty {
  text-align: center;
  padding: 12vh 0;
  color: var(--md-on-surface-variant);
}

.empty h1 {
  font-size: 64px;
  margin: 0;
  color: var(--md-primary);
}
</style>
