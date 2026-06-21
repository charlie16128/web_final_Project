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
    @delete-account="deleteAccount"
  />

  <main class="page-shell">
    <div class="project-page-column">
      <section class="home-hero">
        <div>
          <p class="eyebrow">TeamUp Campus</p>
          <h1>找到適合你的校園專題夥伴</h1>
          <p>
            瀏覽正在招募的隊伍、比對課程與技能需求，讓專題組隊從零散訊息變成清楚可追蹤的媒合流程。
          </p>
        </div>

      </section>

      <ProjectForm
        :disabled="!user"
        disabled-text="登入已建立"
        :open-signal="openCreateFormSignal"
        @create="createProject"
      />

      <section class="home-stats">
        <article>
          <strong>{{ openProjectCount }}</strong>
          <span>開放招募</span>
        </article>

        <article>
          <strong>{{ fullProjectCount }}</strong>
          <span>已額滿隊伍</span>
        </article>

        <article>
          <strong>{{ topSkill || 'Vue' }}</strong>
          <span>熱門技能</span>
          <div v-if="popularSkills.length" class="popular-skill-list" aria-label="熱門技能排名">
            <span
              v-for="skill in popularSkills"
              :key="skill.name"
              class="popular-skill-pill"
            >
              {{ skill.name }} {{ skill.count }} 次
            </span>
          </div>
          <small v-else class="popular-skill-empty">等待資料</small>
        </article>
      </section>

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
        <article v-if="!projects.length" class="empty-state">
          <div class="empty-icon" aria-hidden="true">+</div>
          <h2>目前沒有符合條件的隊伍</h2>
          <p>調整搜尋或篩選條件，也可以建立新的專題開始招募同學。</p>
          <button type="button" @click="openCreateProjectForm">
            建立專題
          </button>
        </article>

        <ProjectCard
          v-for="project in displayedProjects"
          :key="project.id"
          :project="project"
          :user="user"
          @apply="openApplyModal"
          @favorite="toggleFavorite"
          @report="reportProject"
          @update-application="updateApplication"
        />
        <div
          v-if="displayedProjects.length < projects.length"
          ref="projectListSentinel"
          class="project-list-sentinel"
        ></div>
      </section>
    </div>
  </main>

  <FloatingInputModal
    v-if="applyProjectTarget"
    title="申請加入"
    label="申請訊息"
    placeholder="可簡述你的技能或動機"
    submit-text="送出申請"
    :required="false"
    @close="applyProjectTarget = null"
    @submit="submitApplyModal"
  />

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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
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
import { skillTags } from '../utils/projectPresentation'

const router = useRouter()

const {
  user,
  toast,
  showToast,
  showAccountModal,
  loadUser,
  saveAccountSettings,
  deleteAccount,
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
} = useProjects({ user, showToast, onLoginRequired: requireLogin })

const PROJECT_BATCH_SIZE = 5
const visibleProjectCount = ref(PROJECT_BATCH_SIZE)
const projectListSentinel = ref(null)
const applyProjectTarget = ref(null)
const openCreateFormSignal = ref(0)
const skillStatProjects = ref([])
let projectObserver = null

const isAdmin = computed(() => user.value?.role === 'admin' || user.value?.role === 'super_admin')
const displayedProjects = computed(() => projects.value.slice(0, visibleProjectCount.value))
const openProjectCount = computed(() =>
  projects.value.filter((project) =>
    project.accepting_applications &&
    project.current_members < project.max_members
  ).length
)
const fullProjectCount = computed(() =>
  projects.value.filter((project) =>
    project.current_members >= project.max_members
  ).length
)
const popularSkills = computed(() => {
  const countMap = {}

  skillStatProjects.value.forEach((project) => {
    const skills = skillTags(project.required_skills)

    skills.forEach((skill) => {
      countMap[skill] = (countMap[skill] || 0) + 1
    })
  })

  return Object.entries(countMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 3)
})
const topSkill = computed(() => popularSkills.value[0]?.name)

async function loadSkillStatProjects() {
  const response = await api.get('/projects', {
    params: { include_owned: 1 }
  })
  skillStatProjects.value = response.data.projects || []
}

function requireLogin() {
  return router.push({ name: 'login' })
}

function loadMoreProjects() {
  visibleProjectCount.value = Math.min(
    visibleProjectCount.value + PROJECT_BATCH_SIZE,
    projects.value.length
  )
}

function observeProjectListSentinel() {
  if (projectObserver) {
    projectObserver.disconnect()
    projectObserver = null
  }

  if (!projectListSentinel.value || displayedProjects.value.length >= projects.value.length) {
    return
  }

  projectObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      loadMoreProjects()
    }
  }, { rootMargin: '120px' })
  projectObserver.observe(projectListSentinel.value)
}

function resetVisibleProjects() {
  visibleProjectCount.value = PROJECT_BATCH_SIZE
}

function openCreateProjectForm() {
  if (!user.value) {
    requireLogin()
    return
  }

  openCreateFormSignal.value += 1
}

function openApplyModal(project) {
  if (!user.value) {
    requireLogin()
    return
  }

  applyProjectTarget.value = project
}

async function submitApplyModal(payload) {
  if (!applyProjectTarget.value) {
    return
  }

  const target = applyProjectTarget.value
  applyProjectTarget.value = null
  await applyProject(target, payload.message)
}

async function createProject(form) {
  if (!user.value) {
    await requireLogin()
    return
  }

  try {
    await api.post('/projects', form)
    showToast('隊伍已建立')
    await Promise.all([loadProjects(), loadSkillStatProjects()])
  } catch (error) {
    showToast(error.response?.data?.message || '建立隊伍失敗')
  }
}

onMounted(async () => {
  try {
    if (localStorage.getItem('teamup_token')) {
      await loadUser()
    }
    await Promise.all([loadProjects(), loadSkillStatProjects()])
    await nextTick()
    observeProjectListSentinel()
  } catch (error) {
    showToast(error.response?.data?.message || '資料載入失敗')
  }
})

onBeforeUnmount(() => {
  if (projectObserver) {
    projectObserver.disconnect()
  }
})

watch(projects, async () => {
  resetVisibleProjects()
  await nextTick()
  observeProjectListSentinel()
})

watch(displayedProjects, async () => {
  await nextTick()
  observeProjectListSentinel()
})
</script>
