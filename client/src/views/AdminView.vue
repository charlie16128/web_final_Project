<template>
  <AppHeader :user="user" back-home @logout="logout" />

  <main class="admin-layout">
    <section class="panel admin-panel">
      <div class="admin-head">
        <div class="section-title">
          <p class="eyebrow">Admin</p>
          <h2>管理員專用介面</h2>
          <p>處理檢舉、警告會員、停權會員與調整會員權限。</p>
        </div>

        <div class="segmented admin-tabs" :class="{ 'tab-members': tab === 'members' }">
          <button type="button" :class="{ active: tab === 'reports' }" @click="tab = 'reports'">
            待處理檢舉 {{ reports.length }}
          </button>
          <button type="button" :class="{ active: tab === 'members' }" @click="tab = 'members'">
            會員管理
          </button>
        </div>
      </div>

      <section v-if="tab === 'reports'" class="admin-list">
        <article v-if="!reports.length" class="mini-item">目前沒有待處理檢舉</article>

        <article v-for="report in reports" :key="report.id" class="admin-report-item">
          <div>
            <strong>檢舉訊息：{{ report.reason }}</strong>
            <dl class="admin-report-meta">
              <div>
                <dt>檢舉人</dt>
                <dd>{{ report.reporter_name }}（{{ report.reporter_id }}）</dd>
              </div>
              <div>
                <dt>被檢舉人</dt>
                <dd>{{ report.target_user_name || '未指定' }}（{{ report.target_user_id || 'N/A' }}）</dd>
              </div>
              <div v-if="report.project_title">
                <dt>相關隊伍</dt>
                <dd>{{ report.project_title }}</dd>
              </div>
              <div v-if="report.comment_content">
                <dt>相關留言</dt>
                <dd>{{ report.comment_content }}</dd>
              </div>
              <div>
                <dt>送出時間</dt>
                <dd>{{ report.created_at }}</dd>
              </div>
            </dl>
          </div>

          <div class="admin-actions">
            <button class="ghost" type="button" @click="openIgnoreReport(report)">忽略</button>
            <button class="ghost" type="button" @click="openWarnReport(report)">警告</button>
            <button class="ghost danger" type="button" @click="openBanReport(report)">停權</button>
          </div>
        </article>
      </section>

      <section v-else class="admin-list">
        <form class="admin-search" @submit.prevent="loadUsers">
          <input v-model.trim="userSearch" type="search" placeholder="用學號或 email 搜尋會員">
          <button type="submit">搜尋</button>
          <button class="ghost" type="button" @click="clearUserSearch">清除</button>
        </form>

        <article v-if="!users.length" class="mini-item">找不到會員</article>

        <div v-for="member in users" :key="member.student_id" class="admin-user-row">
          <span>
            <strong>{{ member.name }}</strong>
            <small>{{ member.student_id }} | {{ member.email }}</small>
            <small v-if="member.is_suspended">停權中：{{ member.suspended_reason || '未填寫原因' }}</small>
          </span>

          <select
            :value="member.role"
            :disabled="member.role === 'super_admin'"
            @change="updateRole(member, $event.target.value)"
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
            <option v-if="member.role === 'super_admin'" value="super_admin">super_admin</option>
          </select>

          <div class="admin-actions">
            <button class="ghost compact-action" type="button" :disabled="member.role === 'super_admin'" @click="openWarnUser(member)">
              警告
            </button>
            <button class="ghost danger compact-action" type="button" :disabled="member.role === 'super_admin'" @click="openBanUser(member)">
              停權
            </button>
            <button class="ghost compact-action" type="button" :disabled="member.role === 'super_admin' || !member.is_suspended" @click="unbanUser(member)">
              解除
            </button>
          </div>
        </div>
      </section>
    </section>
  </main>

  <FloatingInputModal
    v-if="actionModal.open"
    :title="actionModal.title"
    :label="actionModal.label"
    :placeholder="actionModal.placeholder"
    :submit-text="actionModal.submitText"
    :required="actionModal.required"
    :show-ban-days="actionModal.showBanDays"
    @close="closeActionModal"
    @submit="submitActionModal"
  />

  <ToastMessage :message="toast" />
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'
import AppHeader from '../components/AppHeader.vue'
import FloatingInputModal from '../components/FloatingInputModal.vue'
import ToastMessage from '../components/ToastMessage.vue'

const router = useRouter()
const user = ref(JSON.parse(localStorage.getItem('teamup_user') || 'null'))
const tab = ref('reports')
const reports = ref([])
const users = ref([])
const userSearch = ref('')
const toast = ref('')
const actionModal = reactive({
  open: false,
  type: '',
  title: '',
  label: '',
  placeholder: '',
  submitText: '送出',
  required: true,
  showBanDays: false,
  target: null
})

let toastTimer = 0

function showToast(message) {
  toast.value = message
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = ''
  }, 2400)
}

function isAdmin(currentUser) {
  return currentUser?.role === 'admin' || currentUser?.role === 'super_admin'
}

async function loadUser() {
  const response = await api.get('/users/me')
  user.value = response.data.user
  localStorage.setItem('teamup_user', JSON.stringify(response.data.user))

  if (!isAdmin(user.value)) {
    await router.replace({ name: 'home' })
  }
}

async function loadReports() {
  const response = await api.get('/admin/reports', {
    params: { status: 'pending' }
  })
  reports.value = response.data.reports || []
}

async function loadUsers() {
  const response = await api.get('/admin/users', {
    params: { q: userSearch.value || undefined }
  })
  users.value = response.data.users || []
}

async function clearUserSearch() {
  userSearch.value = ''
  await loadUsers()
}

function openActionModal(options) {
  Object.assign(actionModal, {
    open: true,
    type: options.type,
    title: options.title,
    label: options.label,
    placeholder: options.placeholder || '',
    submitText: options.submitText || '送出',
    required: options.required !== false,
    showBanDays: Boolean(options.showBanDays),
    target: options.target
  })
}

function closeActionModal() {
  actionModal.open = false
  actionModal.target = null
}

function openIgnoreReport(report) {
  openActionModal({
    type: 'ignore-report',
    title: '忽略檢舉',
    label: '處理備註',
    placeholder: '可留空',
    submitText: '忽略',
    required: false,
    target: report
  })
}

function openWarnReport(report) {
  openActionModal({
    type: 'warn-report',
    title: '警告被檢舉人',
    label: '警告訊息',
    placeholder: '請輸入要通知會員的警告內容',
    submitText: '送出警告',
    target: report
  })
}

function openBanReport(report) {
  openActionModal({
    type: 'ban-report',
    title: '停權被檢舉人',
    label: '停權原因',
    placeholder: '請輸入停權原因',
    submitText: '確認停權',
    showBanDays: true,
    target: report
  })
}

function openWarnUser(member) {
  openActionModal({
    type: 'warn-user',
    title: `警告 ${member.name}`,
    label: '警告訊息',
    placeholder: '請輸入要通知會員的警告內容',
    submitText: '送出警告',
    target: member
  })
}

function openBanUser(member) {
  openActionModal({
    type: 'ban-user',
    title: `停權 ${member.name}`,
    label: '停權原因',
    placeholder: '請輸入停權原因',
    submitText: '確認停權',
    showBanDays: true,
    target: member
  })
}

async function submitActionModal(payload) {
  const target = actionModal.target

  try {
    if (actionModal.type === 'ignore-report') {
      await api.patch(`/admin/reports/${target.id}/ignore`, { note: payload.message })
      reports.value = reports.value.filter((item) => item.id !== target.id)
      showToast('檢舉已忽略')
    }

    if (actionModal.type === 'warn-report') {
      await api.patch(`/admin/reports/${target.id}/warn`, { message: payload.message })
      reports.value = reports.value.filter((item) => item.id !== target.id)
      await loadUsers()
      showToast('已送出警告')
    }

    if (actionModal.type === 'ban-report') {
      await api.patch(`/admin/reports/${target.id}/ban`, {
        reason: payload.message,
        ban_days: payload.ban_days
      })
      reports.value = reports.value.filter((item) => item.id !== target.id)
      await loadUsers()
      showToast('已停權會員')
    }

    if (actionModal.type === 'warn-user') {
      await api.post(`/admin/users/${target.student_id}/warn`, { message: payload.message })
      showToast('已送出警告')
    }

    if (actionModal.type === 'ban-user') {
      const response = await api.post(`/admin/users/${target.student_id}/ban`, {
        reason: payload.message,
        ban_days: payload.ban_days
      })
      Object.assign(target, response.data.user)
      showToast('已停權會員')
    }

    closeActionModal()
  } catch (error) {
    showToast(error.response?.data?.message || '操作失敗')
  }
}

async function updateRole(member, role) {
  try {
    const response = await api.patch(`/admin/users/${member.student_id}/role`, { role })
    Object.assign(member, response.data.user)
    showToast('權限已更新')
  } catch (error) {
    showToast(error.response?.data?.message || '權限更新失敗')
    await loadUsers()
  }
}

async function unbanUser(member) {
  try {
    const response = await api.post(`/admin/users/${member.student_id}/unban`)
    Object.assign(member, response.data.user)
    showToast('已解除停權')
  } catch (error) {
    showToast(error.response?.data?.message || '解除停權失敗')
  }
}

async function logout() {
  localStorage.removeItem('teamup_token')
  localStorage.removeItem('teamup_user')
  await router.replace({ name: 'login' })
}

onMounted(async () => {
  try {
    await loadUser()
    if (isAdmin(user.value)) {
      await Promise.all([loadReports(), loadUsers()])
    }
  } catch (error) {
    showToast(error.response?.data?.message || '管理員資料載入失敗')
  }
})
</script>
