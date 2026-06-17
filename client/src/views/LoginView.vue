<template>
  <main class="auth-shell">
    <section class="auth-copy">
      <p class="eyebrow">TeamUp Campus</p>
      <h1>登入組隊平台</h1>
      <p>找到適合的專題夥伴，管理申請與群組討論。</p>
    </section>

    <section class="panel auth-card">
      <form class="stack auth-form" @submit.prevent="login">
        <div class="form-field">
          <label data-required data-error="*請輸入電子郵件">
            Email
            <input class="auth-input" v-model.trim="form.email" type="email" autofocus autocomplete="email">
          </label>
          <p class="field-error">*請輸入電子郵件</p>
        </div>
        <div class="form-field">
          <label data-required data-error="*請輸入密碼">
            密碼
            <input class="auth-input" v-model="form.password" type="password" autocomplete="current-password">
          </label>
          <p class="field-error">*請輸入密碼</p>
        </div>
        <button type="submit" :disabled="loading">{{ loading ? '登入中...' : '登入' }}</button>
      </form>
      <p class="auth-link">還沒有帳號？<RouterLink :to="{ name: 'register' }">前往註冊</RouterLink></p>
    </section>
    <ToastMessage :message="toast" />
  </main>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'
import ToastMessage from '../components/ToastMessage.vue'

const router = useRouter()
const loading = ref(false)
const toast = ref('')
const form = reactive({
  email: '',
  password: ''
})

let toastTimer = 0

function showToast(message) {
  toast.value = message
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = ''
  }, 2400)
}

async function login() {
  loading.value = true
  try {
    const response = await api.post('/login', form)
    localStorage.setItem('teamup_token', response.data.token)
    localStorage.setItem('teamup_user', JSON.stringify(response.data.user))
    await router.replace({ name: 'home' })
  } catch (error) {
    showToast(error.response?.data?.message || '登入失敗，請確認帳號密碼')
  } finally {
    loading.value = false
  }
}
</script>
