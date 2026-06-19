import { ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'

export function useDashboardBase() {
  const router = useRouter()
  const user = ref(JSON.parse(localStorage.getItem('teamup_user') || 'null'))
  const showAccountModal = ref(false)
  const toast = ref('')

  let toastTimer = 0

  function showToast(message) {
    toast.value = message
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => {
      toast.value = ''
    }, 2400)
  }

  async function loadUser() {
    const response = await api.get('/users/me')
    user.value = response.data.user
    localStorage.setItem('teamup_user', JSON.stringify(response.data.user))
  }

  async function saveAccountSettings(form) {
    try {
      const response = await api.put('/users/me', form)
      user.value = response.data.user
      localStorage.setItem('teamup_user', JSON.stringify(response.data.user))
      showAccountModal.value = false
      showToast('帳號資料已更新')
    } catch (error) {
      showToast(error.response?.data?.message || '帳號更新失敗')
    }
  }

  async function deleteAccount() {
    if (!window.confirm('確定要刪除帳號嗎？此操作無法復原。')) {
      return
    }

    try {
      await api.delete('/users/me')
      showAccountModal.value = false
      localStorage.removeItem('teamup_token')
      localStorage.removeItem('teamup_user')
      await router.replace({ name: 'login' })
    } catch (error) {
      showToast(error.response?.data?.message || '刪除帳號失敗')
    }
  }

  async function logout() {
    localStorage.removeItem('teamup_token')
    localStorage.removeItem('teamup_user')
    await router.replace({ name: 'login' })
  }

  return {
    user,
    toast,
    showToast,
    showAccountModal,
    loadUser,
    saveAccountSettings,
    deleteAccount,
    logout
  }
}
