<template>
  <main class="auth-shell">
    <section class="auth-copy">
      <p class="eyebrow">TeamUp Campus</p>
      <h1>建立學生帳號</h1>
      <p>使用學號與 Email 註冊，開始刊登或申請加入專題。</p>
    </section>

    <section class="panel auth-card">
      <form class="stack auth-form" @submit.prevent="register">
        <div class="form-field">
          <label data-required data-error="*請輸入姓名">
            姓名
            <input class="auth-input" v-model.trim="form.name" autofocus autocomplete="name">
          </label>
        </div>
        <div class="form-field">
          <label data-required data-error="*學號格式為 D 加 7 位數字">
            學號
            <input
              class="auth-input"
              v-model.trim="form.student_id"
              minlength="8"
              maxlength="8"
              pattern="D[0-9]{7}"
              title="學號格式為 D 加 7 位數字，例如 D1234567"
            >
          </label>
        </div>
        <div class="form-field">
          <label data-required data-error="*請輸入電子郵件">
            Email
            <input class="auth-input" v-model.trim="form.email" type="email" autocomplete="email">
          </label>
        </div>
        <div class="form-field">
          <label data-required data-error="*密碼至少 6 碼，僅能使用英文或數字">
            密碼
            <input
              class="auth-input"
              v-model="form.password"
              type="password"
              minlength="6"
              pattern="[A-Za-z0-9]{6,}"
              title="密碼至少 6 碼，限英文字母與數字"
              autocomplete="new-password"
            >
          </label>
        </div>
        <button type="submit" :disabled="loading">{{ loading ? '註冊中...' : '註冊' }}</button>
      </form>
      <p class="auth-link">已有帳號？<RouterLink :to="{ name: 'login' }">前往登入</RouterLink></p>
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
  name: '',
  student_id: '',
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

async function register() {
  loading.value = true
  try {
    const response = await api.post('/register', form)
    localStorage.setItem('teamup_token', response.data.token)
    localStorage.setItem('teamup_user', JSON.stringify(response.data.user))
    await router.replace({ name: 'home' })
  } catch (error) {
    showToast(error.response?.data?.message || '註冊失敗，請檢查輸入資料')
  } finally {
    loading.value = false
  }
}
</script>
