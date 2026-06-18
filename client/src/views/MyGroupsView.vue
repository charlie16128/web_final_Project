<template>
  <AppHeader :user="user" show-account @account="showAccountModal = true" @logout="logout" />
  <MainNavbar />

  <AccountModal
    v-if="user && showAccountModal"
    :user="user"
    @close="showAccountModal = false"
    @save="saveAccountSettings"
  />

  <main class="page-shell">
    <div class="page-center-column">
      <GroupSidebar
        v-model="groupTab"
        :groups="groups"
        :applications="myApplications"
        :user="user"
      />
    </div>
  </main>

  <ToastMessage :message="toast" />
</template>

<script setup>
import { onMounted } from 'vue'
import AccountModal from '../components/AccountModal.vue'
import AppHeader from '../components/AppHeader.vue'
import GroupSidebar from '../components/GroupSidebar.vue'
import MainNavbar from '../components/MainNavbar.vue'
import ToastMessage from '../components/ToastMessage.vue'
import { useDashboardBase } from '../composables/useDashboardBase'
import { useGroupsAndInvitations } from '../composables/useGroupsAndInvitations'

const {
  user,
  toast,
  showToast,
  showAccountModal,
  loadUser,
  saveAccountSettings,
  logout
} = useDashboardBase()

const {
  groups,
  groupTab,
  myApplications,
  loadGroups,
  loadMyApplications
} = useGroupsAndInvitations({ showToast })

onMounted(async () => {
  try {
    await Promise.all([
      loadUser(),
      loadGroups(),
      loadMyApplications()
    ])
  } catch (error) {
    showToast(error.response?.data?.message || '資料載入失敗')
  }
})
</script>
