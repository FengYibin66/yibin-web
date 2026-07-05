import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { fetchMe, login as loginApi, logout as logoutApi } from '@/api/auth'
import type { AuthUser } from '@/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const initialized = ref(false)
  const loading = ref(false)

  const isAuthenticated = computed(() => user.value !== null)

  async function ensureSession(): Promise<boolean> {
    if (isAuthenticated.value) {
      return true
    }
    return refreshSession()
  }

  async function refreshSession(): Promise<boolean> {
    loading.value = true
    try {
      user.value = await fetchMe()
      return true
    } catch {
      user.value = null
      return false
    } finally {
      initialized.value = true
      loading.value = false
    }
  }

  async function login(username: string, password: string): Promise<void> {
    loading.value = true
    try {
      user.value = await loginApi(username, password)
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  async function logout(): Promise<void> {
    try {
      await logoutApi()
    } catch {
      // ignore network errors on logout
    } finally {
      user.value = null
      initialized.value = true
    }
  }

  function clearSession(): void {
    user.value = null
    initialized.value = true
  }

  return {
    user,
    initialized,
    loading,
    isAuthenticated,
    ensureSession,
    refreshSession,
    login,
    logout,
    clearSession,
  }
})
