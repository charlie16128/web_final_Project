import { reactive, ref } from 'vue'
import api from '../services/api'

export function useProjects({ user, showToast, onApplicationSubmitted, onApplicationUpdated } = {}) {
  const projects = ref([])
  const reportProjectTarget = ref(null)
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

  let searchTimer = 0

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

  async function loadProjectApplications(project) {
    const response = await api.get(`/projects/${project.id}/applications`)
    project.applications = response.data.applications || []
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
      const currentUserId = user?.value?.student_id || user?.value?.id
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
      await loadProjects()
      await onApplicationSubmitted?.()
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
      await loadProjects()
      await onApplicationUpdated?.()
    } catch (error) {
      showToast(error.response?.data?.message || '更新申請失敗')
    }
  }

  return {
    projects,
    filters,
    statusOptions,
    filterOptions,
    reportProjectTarget,
    loadProjects,
    scheduleProjectLoad,
    applyProject,
    toggleFavorite,
    reportProject,
    submitProjectReport,
    updateApplication
  }
}
