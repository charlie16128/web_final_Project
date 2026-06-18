import { createRouter, createWebHistory } from 'vue-router'

import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import GroupView from '../views/GroupView.vue'
import AdminView from '../views/AdminView.vue'
import MyGroupsView from '../views/MyGroupsView.vue'
import ApplicationsInvitationsView from '../views/ApplicationsInvitationsView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { requiresAuth: true }
    },
    {
      path: '/my-groups',
      name: 'my-groups',
      component: MyGroupsView,
      meta: { requiresAuth: true }
    },
    {
      path: '/applications-invitations',
      name: 'applications-invitations',
      component: ApplicationsInvitationsView,
      meta: { requiresAuth: true }
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView
    },
    {
      path: '/groups/:id',
      name: 'group',
      component: GroupView,
      meta: { requiresAuth: true }
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminView,
      meta: { requiresAuth: true, requiresAdmin: true }
    }
  ]
})

router.beforeEach((to) => {
  const token = localStorage.getItem('teamup_token')

  if (to.meta.requiresAuth && !token) {
    return { name: 'login' }
  }

  if (to.meta.requiresAdmin) {
    const user = JSON.parse(localStorage.getItem('teamup_user') || 'null')
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      return { name: 'home' }
    }
  }

  if (token && (to.name === 'login' || to.name === 'register')) {
    return { name: 'home' }
  }
})

export default router
