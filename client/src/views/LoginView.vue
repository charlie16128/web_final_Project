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
            <input class="auth-input" v-model.trim="form.email" type="email" autofocus autocomplete="email" placeholder="test0001@gamil.com">
          </label>
        </div>
        <div class="form-field">
          <label data-required data-error="*請輸入密碼">
            密碼
            <input class="auth-input" v-model="form.password" type="password" autocomplete="current-password" placeholder="test0001">
          </label>
        </div>
        <button type="submit" :disabled="loading">{{ loading ? '登入中...' : '登入' }}</button>
      </form>
      <p class="auth-link">還沒有帳號？<RouterLink :to="{ name: 'register' }">前往註冊</RouterLink></p>
    </section>
    <AppDialog
      v-if="noticeDialog.open"
      :title="noticeDialog.title"
      :message="noticeDialog.message"
      confirm-text="我知道了"
      @confirm="closeNoticeDialog"
    />
    <ToastMessage :message="toast" />
  </main>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'
import AppDialog from '../components/AppDialog.vue'
import ToastMessage from '../components/ToastMessage.vue'

const router = useRouter()
const loading = ref(false)
const toast = ref('')
const noticeDialog = reactive({
  open: false,
  title: '你的帳號已被停用',
  message: ''
})
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

function showNoticeDialog(message, bannedUntil = null) {
  noticeDialog.title = suspensionNoticeTitle(message, bannedUntil)
  noticeDialog.message = suspensionNoticeMessage(message, bannedUntil)
  noticeDialog.open = true
}

function closeNoticeDialog() {
  noticeDialog.open = false
  noticeDialog.title = '帳號已被停用'
  noticeDialog.message = ''
}

function isSuspensionMessage(message) {
  return message.includes('停權') || message.includes('封鎖')
}

function suspensionNoticeMessage(message, bannedUntil) {
  const reason = extractSuspensionReason(message)

  if (bannedUntil) {
    return [
      `帳號已被停用至 ${formatSuspensionUntil(bannedUntil)}`,
      reason ? `原因：${reason}` : ''
    ].filter(Boolean).join('\n')
  }

  if (message.includes('永久')) {
    return [
      '帳號已被永久停用',
      reason ? `原因：${reason}` : ''
    ].filter(Boolean).join('\n')
  }

  return message
}

function suspensionNoticeTitle(message, bannedUntil) {
  if (bannedUntil) {
    return `帳號停用至 ${formatSuspensionUntil(bannedUntil)}`
  }
  if (message.includes('永久')) {
    return '帳號已被永久停用'
  }
  return '帳號已被停用'
}

function extractSuspensionReason(message) {
  const parts = message.split('：')
  return parts.length > 1 ? parts.slice(1).join('：').trim() : ''
}

function formatSuspensionUntil(value) {
  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T')
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(normalized) ? normalized : `${normalized}Z`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date)
}

async function login() {
  loading.value = true
  try {
    const response = await api.post('/login', form)
    localStorage.setItem('teamup_token', response.data.token)
    localStorage.setItem('teamup_user', JSON.stringify(response.data.user))
    await router.replace({ name: 'home' })
  } catch (error) {
    const message = error.response?.data?.message || '登入失敗，請確認帳號密碼'
    if (isSuspensionMessage(message)) {
      showNoticeDialog(message, error.response?.data?.banned_until || null)
    } else {
      showToast(message)
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const loginNotice = sessionStorage.getItem('teamup_login_notice')
  if (loginNotice) {
    sessionStorage.removeItem('teamup_login_notice')
    try {
      const parsedNotice = JSON.parse(loginNotice)
      showNoticeDialog(parsedNotice.message || '', parsedNotice.banned_until || null)
    } catch {
      showNoticeDialog(loginNotice)
    }
  }
})
</script>
