<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import { ROUTE_NAMES } from '@/constants/routes'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const isAuthLayout = computed(() => route.meta.layout === 'auth')
const isWideMain = computed(() => route.meta.wide === true)

async function handleLogout(): Promise<void> {
  await authStore.logout()
  await router.replace({ name: ROUTE_NAMES.LOGIN })
}
</script>

<template>
  <div
    v-if="isAuthLayout"
    class="auth-shell"
  >
    <RouterView />
  </div>
  <div
    v-else
    class="app-layout"
  >
    <header class="app-header">
      <RouterLink
        :to="{ name: ROUTE_NAMES.PIPELINE_TRIGGER }"
        class="app-title"
      >
        AI 公众号 Pipeline
      </RouterLink>
      <nav class="app-nav">
        <RouterLink to="/">
          触发 Run
        </RouterLink>
        <RouterLink to="/layout-templates">
          排版模板库
        </RouterLink>
        <RouterLink to="/image-library">
          图片库
        </RouterLink>
        <span
          v-if="authStore.user"
          class="app-user"
        >
          {{ authStore.user.username }}
        </span>
        <el-button
          v-if="authStore.user"
          link
          type="primary"
          @click="handleLogout"
        >
          退出
        </el-button>
      </nav>
    </header>
    <main
      class="app-main"
      :class="{ 'app-main--wide': isWideMain }"
    >
      <RouterView />
    </main>
  </div>
</template>

<style scoped lang="scss">
.auth-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
}

.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
}

.app-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  text-decoration: none;
  cursor: pointer;
  transition: color 0.15s ease;

  &:hover {
    color: var(--el-color-primary);
  }
}

.app-nav {
  display: flex;
  align-items: center;
  gap: 16px;
}

.app-nav a {
  color: var(--el-text-color-primary);
  text-decoration: none;

  &.router-link-active {
    color: var(--el-color-primary);
  }
}

.app-user {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.app-main {
  flex: 1;
  padding: 24px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

.app-main--wide {
  max-width: 1440px;
}
</style>
