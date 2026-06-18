import { reactive, ref } from 'vue'
import api from '../services/api'

export function useGroupsAndInvitations({ showToast } = {}) {
  const groups = reactive({
    owned: [],
    joined: []
  })
  const groupTab = ref('all')
  const myApplications = ref([])
  const myInvitations = ref([])

  async function loadGroups() {
    const response = await api.get('/groups/me')
    groups.owned = response.data.owned || []
    groups.joined = response.data.joined || []
  }

  async function loadMyApplications() {
    const response = await api.get('/my-applications')
    myApplications.value = response.data.applications || []
  }

  async function loadMyInvitations() {
    const response = await api.get('/me/invitations')
    myInvitations.value = response.data.invitations || []
  }

  async function acceptInvitation(invitation) {
    try {
      await api.post(`/invitations/${invitation.id}/accept`)
      showToast('已接受邀請')
      await Promise.all([
        loadMyInvitations(),
        loadMyApplications(),
        loadGroups()
      ])
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

  return {
    groups,
    groupTab,
    myApplications,
    myInvitations,
    loadGroups,
    loadMyApplications,
    loadMyInvitations,
    acceptInvitation,
    rejectInvitation
  }
}
