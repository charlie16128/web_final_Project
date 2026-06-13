<template>
  <AppHeader :user="user" show-account @account="showAccountModal = true" @logout="logout" />

  <AccountModal
    v-if="user && showAccountModal"
    :user="user"
    @close="showAccountModal = false"
    @save="saveAccountSettings"
  />

  <main class="layout">
    <GroupSidebar v-model="groupTab" :groups="groups" :applications="myApplications" />

    <ProjectForm @create="createProject" />

    <section class="toolbar">
      <input v-model.trim="filters.q" type="search" placeholder="搜尋專題、課程或技能" @input="scheduleProjectLoad">
      <select v-model="filters.status" @change="loadProjects">
        <option value="">全部狀態</option>
        <option value="open">開放中</option>
        <option value="full">已滿員</option>
        <option value="closed">已關閉</option>
      </select>
      <button class="ghost" type="button" @click="loadProjects">重新整理</button>
    </section>

    <section class="projects">
      <article v-if="!projects.length" class="project-card">
        <p class="description">目前沒有符合條件的專題。</p>
      </article>

      <ProjectCard
        v-for="project in projects"
        :key="project.id"
        :project="project"
        :user="user"
        @apply="applyProject"
        @comment="createComment"
        @update-application="updateApplication"
      />
    </section>
  </main>

  <ToastMessage :message="toast" />
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'
import AccountModal from '../components/AccountModal.vue'
import AppHeader from '../components/AppHeader.vue'
import GroupSidebar from '../components/GroupSidebar.vue'
import ProjectCard from '../components/ProjectCard.vue'
import ProjectForm from '../components/ProjectForm.vue'
import ToastMessage from '../components/ToastMessage.vue'

const router = useRouter()
const user = ref(JSON.parse(localStorage.getItem('teamup_user') || 'null'))
const projects = ref([])
const myApplications = ref([])
const groups = reactive({
  owned: [],
  joined: []
})
const groupTab = ref('all')
const showAccountModal = ref(false)
const toast = ref('')
const filters = reactive({
  q: '',
  status: ''
})

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
      status: filters.status || undefined
    }
  })

  projects.value = response.data.projects.map(normalizeProject)
  await Promise.all(projects.value.map(async (project) => {
    await loadComments(project)
    if (user.value && user.value.id === project.owner_id) {
      await loadProjectApplications(project)
    }
  }))
}

function scheduleProjectLoad() {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    loadProjects().catch((error) => {
      showToast(error.response?.data?.message || '專題載入失敗')
    })
  }, 250)
}

async function loadGroups() {
  const response = await api.get('/groups/me')
  groups.owned = response.data.owned || []
  groups.joined = response.data.joined || []
}

async function loadComments(project) {
  const response = await api.get(`/projects/${project.id}/comments`)
  project.comments = response.data.comments || []
}

async function loadProjectApplications(project) {
  const response = await api.get(`/projects/${project.id}/applications`)
  project.applications = response.data.applications || []
}

async function loadMyApplications() {
  const response = await api.get('/my-applications')
  myApplications.value = response.data.applications || []
}

async function createProject(form) {
  try {
    await api.post('/projects', form)
    showToast('專題已建立')
    await Promise.all([loadProjects(), loadGroups()])
  } catch (error) {
    showToast(error.response?.data?.message || '建立專題失敗')
  }
}

async function applyProject(project) {
  try {
    await api.post(`/projects/${project.id}/apply`, {
      message: project.applyMessage
    })
    project.applyMessage = ''
    showToast('已送出加入申請')
    await loadMyApplications()
  } catch (error) {
    showToast(error.response?.data?.message || '申請失敗')
  }
}

async function createComment(project) {
  try {
    await api.post(`/projects/${project.id}/comments`, {
      content: project.commentContent
    })
    project.commentContent = ''
    showToast('留言已送出')
    await loadComments(project)
  } catch (error) {
    showToast(error.response?.data?.message || '留言失敗')
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
      loadMyApplications()
    ])
  } catch (error) {
    showToast(error.response?.data?.message || '資料載入失敗')
  }
})
</script>
