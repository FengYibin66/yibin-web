import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import App from './App.vue'
import router from './router'
import { setUnauthorizedHandler } from '@/api/request'
import { ROUTE_NAMES } from '@/constants/routes'
import { useAuthStore } from '@/stores/auth'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(ElementPlus)

setUnauthorizedHandler(() => {
  const authStore = useAuthStore()
  authStore.clearSession()
  if (router.currentRoute.value.name !== ROUTE_NAMES.LOGIN) {
    void router.push({
      name: ROUTE_NAMES.LOGIN,
      query: { redirect: router.currentRoute.value.fullPath },
    })
  }
})

app.mount('#app')
