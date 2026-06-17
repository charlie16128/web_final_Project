<template>
  <AppHeader :user="user" show-account @account="showAccountModal = true" @logout="logout" />

  <AccountModal
    v-if="user && showAccountModal"
    :user="user"
    @close="showAccountModal = false"
    @save="saveAccountSettings"
  />

  <main class="layout">
    <GroupSidebar v-model="groupTab" :groups="groups" :applications="myApplications" :user="user" />

    <div class="main-column">
      <ProjectForm @create="createProject" />

      <section class="panel invite-list">
        <div class="section-title">
          <h2>我的邀請</h2>
          <p>接受隊長邀請後，就會加入該隊伍。</p>
        </div>

        <div class="applications-list">
          <div v-for="invitation in myInvitations" :key="invitation.id" class="application-row">
            <span>
              <b>{{ invitation.project_title }}</b><br>
              <small>邀請人：{{ invitation.inviter_name }}</small><br>
              {{ invitation.message || '沒有邀請訊息' }}
            </span>
            <button class="ghost" type="button" @click="acceptInvitation(invitation)">接受</button>
            <button class="ghost" type="button" @click="rejectInvitation(invitation)">拒絕</button>
          </div>
        </div>
      </section>

      <section class="toolbar">
        <input v-model.trim="filters.q" type="search" placeholder="搜尋隊伍、課程或技能" @input="scheduleProjectLoad">
        <CustomSelect
          v-model="filters.status"
          :options="statusOptions"
          placeholder="所有狀態"
          @update:modelValue="loadProjects"
        />
        <button class="ghost" type="button" @click="loadProjects">重新整理</button>
        <CustomSelect
          v-model="filters.filter"
          :options="filterOptions"
          placeholder="所有隊伍"
          @update:modelValue="loadProjects"
        />
      </section>

      <section class="projects">
        <article v-if="!projects.length" class="project-card">
          <p class="description">目前沒有符合條件的隊伍。</p>
        </article>

        <ProjectCard
          v-for="project in projects"
          :key="project.id"
          :project="project"
          :user="user"
          @apply="applyProject"
          @favorite="toggleFavorite"
          @report="reportProject"
          @update-application="updateApplication"
        />
      </section>
    </div>
  </main>

  <FloatingInputModal
    v-if="reportProjectTarget"
    title="檢舉隊伍"
    label="檢舉訊息"
    placeholder="請輸入檢舉原因"
    submit-text="送出檢舉"
    @close="reportProjectTarget = null"
    @submit="submitProjectReport"
  />

  <ToastMessage :message="toast" />
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'
import AccountModal from '../components/AccountModal.vue'
import AppHeader from '../components/AppHeader.vue'
import CustomSelect from '../components/common/CustomSelect.vue'
import FloatingInputModal from '../components/FloatingInputModal.vue'
import GroupSidebar from '../components/GroupSidebar.vue'
import ProjectCard from '../components/ProjectCard.vue'
import ProjectForm from '../components/ProjectForm.vue'
import ToastMessage from '../components/ToastMessage.vue'

const router = useRouter()
const user = ref(JSON.parse(localStorage.getItem('teamup_user') || 'null'))
const projects = ref([])
const myApplications = ref([])
const myInvitations = ref([])
const groups = reactive({
  owned: [],
  joined: []
})
const groupTab = ref('all')
const showAccountModal = ref(false)
const reportProjectTarget = ref(null)
const toast = ref('')
const filters = reactive({
  q: '',
  status: '',
  filter: ''
})

const statusOptions = [
  { label: '所有狀態', value: '' },
  { label: '招募中', value: 'open' },
  { label: '已額滿', value: 'full' },
  { label: '已關閉', value: 'closed' }
]

const filterOptions = [
  { label: '所有隊伍', value: '' },
  { label: '我的收藏', value: 'favorited' }
]

let toastTimer = 0
let searchTimer = 0

function showToast(message) {
  toast.value = message
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = ''
  }, 2400)
}

function normalizeProject(project) {
  return {
    ...project,
    accepting_applications: Boolean(project.accepting_applications),
    is_favorited: Boolean(project.is_favorited),
    applyMessage: '',
    commentContent: '',
    comments: [],
    applications: []
  }
}

async function loadUser() {
  const response = await api.get('/users/me')
  user.value = response.data.user
  localStorage.setItem('teamup_user', JSON.stringify(response.data.user))
}

async function loadProjects() {
  const response = await api.get('/projects', {
    params: {
      q: filters.q || undefined,
      status: filters.status || undefined,
      filter: filters.filter || undefined
    }
  })

  projects.value = response.data.projects.map(normalizeProject)
  await Promise.all(projects.value.map(async (project) => {
    const currentUserId = user.value?.student_id || user.value?.id
    if (currentUserId === project.owner_id) {
      await loadProjectApplications(project)
    }
  }))
}

function scheduleProjectLoad() {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    loadProjects().catch((error) => {
      showToast(error.response?.data?.message || '搜尋載入失敗')
    })
  }, 250)
}

async function loadGroups() {
  const response = await api.get('/groups/me')
  groups.owned = response.data.owned || []
  groups.joined = response.data.joined || []
}

async function loadProjectApplications(project) {
  const response = await api.get(`/projects/${project.id}/applications`)
  project.applications = response.data.applications || []
}

async function loadMyApplications() {
  const response = await api.get('/my-applications')
  myApplications.value = response.data.applications || []
}

async function loadMyInvitations() {
  const response = await api.get('/me/invitations')
  myInvitations.value = response.data.invitations || []
}

async function createProject(form) {
  try {
    await api.post('/projects', form)
    showToast('隊伍已建立')
    await Promise.all([loadProjects(), loadGroups()])
  } catch (error) {
    showToast(error.response?.data?.message || '建立隊伍失敗')
  }
}

async function toggleFavorite(project) {
  try {
    if (project.is_favorited) {
      await api.delete(`/projects/${project.id}/favorite`)
      project.is_favorited = false
      showToast('已移除收藏')
    } else {
      await api.post(`/projects/${project.id}/favorite`)
      project.is_favorited = true
      showToast('已加入收藏')
    }

    if (filters.filter === 'favorited') {
      await loadProjects()
    }
  } catch (error) {
    showToast(error.response?.data?.message || '收藏更新失敗')
  }
}

async function applyProject(project) {
  try {
    await api.post(`/projects/${project.id}/apply`, {
      message: project.applyMessage
    })
    project.applyMessage = ''
    showToast('申請已送出')
    await Promise.all([loadProjects(), loadMyApplications()])
  } catch (error) {
    showToast(error.response?.data?.message || '申請失敗')
  }
}

function reportProject(project) {
  reportProjectTarget.value = project
}

async function submitProjectReport(payload) {
  if (!reportProjectTarget.value) {
    return
  }

  try {
    await api.post('/reports', {
      target_user_id: reportProjectTarget.value.owner_id,
      target_project_id: reportProjectTarget.value.id,
      reason: payload.message,
      detail: ''
    })
    reportProjectTarget.value = null
    showToast('檢舉已送出，管理員會盡快處理')
  } catch (error) {
    showToast(error.response?.data?.message || '檢舉送出失敗')
  }
}

async function updateApplication(project, application, status) {
  try {
    await api.put(`/applications/${application.id}`, { status })
    project.applications = project.applications.filter((item) => item.id !== application.id)
    showToast('申請狀態已更新')
    await Promise.all([loadProjects(), loadGroups()])
  } catch (error) {
    showToast(error.response?.data?.message || '更新申請失敗')
  }
}

async function acceptInvitation(invitation) {
  try {
    await api.post(`/invitations/${invitation.id}/accept`)
    showToast('已接受邀請')
    await Promise.all([loadMyInvitations(), loadProjects(), loadGroups()])
  } catch (error) {
    showToast(error.response?.data?.message || '接受邀請失敗')
  }
}

async function rejectInvitation(invitation) {
  try {
    await api.post(`/invitations/${invitation.id}/reject`)
    showToast('已拒絕邀請')
    await loadMyInvitations()
  } catch (error) {
    showToast(error.response?.data?.message || '拒絕邀請失敗')
  }
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

async function logout() {
  localStorage.removeItem('teamup_token')
  localStorage.removeItem('teamup_user')
  await router.replace({ name: 'login' })
}

onMounted(async () => {
  try {
    await loadUser()
    await Promise.all([
      loadProjects(),
      loadGroups(),
      loadMyApplications(),
      loadMyInvitations()
    ])
  } catch (error) {
    showToast(error.response?.data?.message || '資料載入失敗')
  }
})
</script>
