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
      <section class="panel application-invitation-panel">
        <div class="section-title">
          <h2>申請邀請</h2>
          <p>查看你送出的申請與收到的隊伍邀請。</p>
        </div>

        <div
          class="segmented application-tabs"
          :class="{ 'tab-invitations': activeTab === 'invitations' }"
        >
          <button
            type="button"
            :class="{ active: activeTab === 'applications' }"
            @click="selectTab('applications')"
          >
            我的申請
          </button>

          <button
            type="button"
            :class="{ active: activeTab === 'invitations' }"
            @click="selectTab('invitations')"
          >
            我的邀請
          </button>
        </div>

        <section v-if="activeTab === 'applications'" class="applications-list">
          <article v-if="!myApplications.length" class="mini-item">
            <p class="description">目前沒有申請紀錄。</p>
          </article>

          <div
            v-for="application in myApplications"
            :key="application.id"
            class="application-row"
          >
            <span>
              <b>{{ application.project_title }}</b><br>
              <small>狀態：{{ application.status }}</small>
            </span>
          </div>
        </section>

        <section v-else class="applications-list invite-list">
          <article v-if="!myInvitations.length" class="mini-item">
            <p class="description">目前沒有邀請。</p>
          </article>

          <div
            v-for="invitation in myInvitations"
            :key="invitation.id"
            class="application-row"
          >
            <span>
              <b>{{ invitation.project_title }}</b><br>
              <small>邀請人：{{ invitation.inviter_name }}</small><br>
              {{ invitation.message || '沒有邀請訊息' }}
            </span>

            <button class="ghost" type="button" @click="acceptInvitation(invitation)">
              接受
            </button>

            <button class="ghost" type="button" @click="rejectInvitation(invitation)">
              拒絕
            </button>
          </div>
        </section>
      </section>
    </div>
  </main>

  <ToastMessage :message="toast" />
</template>

<script setup>
import { onMounted, ref } from 'vue'
import AccountModal from '../components/AccountModal.vue'
import AppHeader from '../components/AppHeader.vue'
import MainNavbar from '../components/MainNavbar.vue'
import ToastMessage from '../components/ToastMessage.vue'
import { useDashboardBase } from '../composables/useDashboardBase'
import { useGroupsAndInvitations } from '../composables/useGroupsAndInvitations'

const activeTab = ref('applications')

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
  myApplications,
  myInvitations,
  loadMyApplications,
  loadMyInvitations,
  acceptInvitation,
  rejectInvitation
} = useGroupsAndInvitations({ showToast })

async function selectTab(tab) {
  activeTab.value = tab

  try {
    if (tab === 'applications') {
      await loadMyApplications()
    } else {
      await loadMyInvitations()
    }
  } catch (error) {
    showToast(error.response?.data?.message || '資料載入失敗')
  }
}

onMounted(async () => {
  try {
    await Promise.all([
      loadUser(),
      loadMyApplications(),
      loadMyInvitations()
    ])
  } catch (error) {
    showToast(error.response?.data?.message || '資料載入失敗')
  }
})
</script>
