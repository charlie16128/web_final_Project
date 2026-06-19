<template>
  <AppHeader :user="user" show-account @account="showAccountModal = true" @logout="logout" />
  <MainNavbar />

  <div v-if="isAdmin" class="admin-entry-shell">
    <RouterLink
      class="admin-entry-button"
      :to="{ name: 'admin' }"
    >
      管理員專用介面
    </RouterLink>
  </div>

  <AccountModal
    v-if="user && showAccountModal"
    :user="user"
    @close="showAccountModal = false"
    @save="saveAccountSettings"
  />

  <main class="page-shell">
    <div class="project-page-column">
      <ProjectForm @create="createProject" />

      <section class="toolbar">
        <input
          v-model.trim="filters.q"
          type="search"
          placeholder="搜尋隊伍、課程或技能"
          @input="scheduleProjectLoad"
        >

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
import { computed, onMounted } from 'vue'
import api from '../services/api'
import AccountModal from '../components/AccountModal.vue'
import AppHeader from '../components/AppHeader.vue'
import MainNavbar from '../components/MainNavbar.vue'
import CustomSelect from '../components/common/CustomSelect.vue'
import FloatingInputModal from '../components/FloatingInputModal.vue'
import ProjectCard from '../components/ProjectCard.vue'
import ProjectForm from '../components/ProjectForm.vue'
import ToastMessage from '../components/ToastMessage.vue'
import { useDashboardBase } from '../composables/useDashboardBase'
import { useProjects } from '../composables/useProjects'

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
} = useProjects({ user, showToast })

const isAdmin = computed(() => user.value?.role === 'admin' || user.value?.role === 'super_admin')

async function createProject(form) {
  try {
    await api.post('/projects', form)
    showToast('隊伍已建立')
    await loadProjects()
  } catch (error) {
    showToast(error.response?.data?.message || '建立隊伍失敗')
  }
}

onMounted(async () => {
  try {
    await loadUser()
    await loadProjects()
  } catch (error) {
    showToast(error.response?.data?.message || '資料載入失敗')
  }
})
</script>
