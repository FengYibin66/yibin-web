import { createRouter, createWebHistory } from 'vue-router'

import { ROUTE_NAMES } from '@/constants/routes'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: ROUTE_NAMES.LOGIN,
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true, layout: 'auth' },
    },
    {
      path: '/',
      name: ROUTE_NAMES.PIPELINE_TRIGGER,
      component: () => import('@/views/PipelineTriggerView.vue'),
    },
    {
      path: '/runs/:id',
      name: ROUTE_NAMES.RUN_DETAIL,
      component: () => import('@/views/RunDetailView.vue'),
      props: true,
    },
    {
      path: '/runs/:id/edit',
      redirect: (to) => ({ path: `/runs/${to.params.id}`, query: { step: 'writer' } }),
    },
    {
      path: '/runs/:id/preview',
      name: ROUTE_NAMES.DRAFT_PREVIEW,
      component: () => import('@/views/DraftPreviewView.vue'),
      props: true,
    },
    {
      path: '/image-library',
      name: ROUTE_NAMES.IMAGE_LIBRARY,
      component: () => import('@/views/ImageLibraryView.vue'),
      meta: { wide: true },
    },
    {
      path: '/layout-templates',
      name: ROUTE_NAMES.LAYOUT_TEMPLATES,
      component: () => import('@/views/LayoutTemplatesView.vue'),
      meta: { wide: true },
    },
    {
      path: '/layout-templates/:id',
      name: ROUTE_NAMES.LAYOUT_TEMPLATE_DETAIL,
      component: () => import('@/views/LayoutTemplateDetailView.vue'),
      props: true,
      meta: { wide: true },
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (to.meta.public) {
    if (to.name === ROUTE_NAMES.LOGIN) {
      const ok = await authStore.ensureSession()
      if (ok) {
        const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '/'
        return redirect
      }
    }
    return true
  }

  const ok = await authStore.ensureSession()
  if (ok) {
    return true
  }

  return {
    name: ROUTE_NAMES.LOGIN,
    query: { redirect: to.fullPath },
  }
})

export default router
