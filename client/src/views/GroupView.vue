<template>
  <AppHeader :user="user" back-home @logout="logout" />

  <main class="group-layout">
    <div v-if="group" class="group-side">
      <section class="panel group-detail">
        <template v-if="!showEditForm">
          <div class="project-head">
            <div>
              <p class="eyebrow">身分 : {{ relationLabel }}</p>
              <div class="project-title-row">
                <h2>{{ group.title }}</h2>
                <button
                  v-if="canShowMembershipAction"
                  class="ghost danger compact-action"
                  type="button"
                  @click="handleMembershipAction"
                >
                  {{ membershipActionText }}
                </button>
              </div>
              <div class="meta">
                {{ group.course_name || '未填課程' }} /
                {{ group.teacher_name || '未填教師' }} /
                建立者 {{ group.owner_name }}
              </div>
            </div>
            <div class="badge-stack">
              <span class="badge" :class="groupStatusClass">{{ groupStatusText }}</span>
              <span v-if="!group.accepting_applications" class="badge paused">暫停申請</span>
            </div>
          </div>

          <dl class="detail-grid">
            <div>
              <dt>專題名稱</dt>
              <dd>{{ group.title }}</dd>
            </div>
            <div>
              <dt>人數</dt>
              <dd>{{ group.current_members }} / {{ group.max_members }}</dd>
            </div>
            <div>
              <dt>需要技能</dt>
              <dd>{{ group.required_skills || '未填' }}</dd>
            </div>
            <div>
              <dt>聯絡方式</dt>
          <dd>{{ group.contact || '未填' }}</dd>
            </div>
          </dl>

          <section>
            <h3>專題說明</h3>
            <!-- <p class="description">{{ group.description }}</p> -->
            <textarea v-model.trim="editForm.description" rows="4" readonly></textarea>
          </section>

          <button
            v-if="group.relation === 'owned'"
            class="full-width"
            type="button"
            @click="toggleEditForm"
          >
            編輯專題資料
          </button>
        </template>

        <form v-else class="group-edit-form" @submit.prevent="saveProject">
          <div class="project-head">
            <div>
              <p class="eyebrow">編輯專題資料</p>
              <label>
                專題名稱
                <input v-model.trim="editForm.title" required>
              </label>
              <div class="grid-form compact-fields">
                <label>
                  課程名稱
                  <input v-model.trim="editForm.course_name">
                </label>
                <label>
                  授課教師
                  <input v-model.trim="editForm.teacher_name">
                </label>
              </div>
            </div>
            <div class="badge-stack edit-status">
              <label>
                專題狀態
                <button
                  class="status-control"
                  :class="editStatusClass"
                  type="button"
                  @click="cycleProjectStatus"
                >
                  {{ editStatusText }}
                </button>
              </label>
            </div>
          </div>

          <div class="detail-grid edit-detail-grid">
            <label>
              目前人數
              <input v-model.number="editForm.current_members" type="number" min="1">
            </label>
            <label>
              人數上限
              <input v-model.number="editForm.max_members" type="number" min="2" required>
            </label>
            <label>
              需要技能
              <input v-model.trim="editForm.required_skills">
            </label>
            <label>
              聯絡方式
              <input v-model.trim="editForm.contact" placeholder="Email / Line / Discord">
            </label>
          </div>

          <label class="checkbox-row">
            <input v-model="editForm.accepting_applications" type="checkbox">
            <span>開放加入申請</span>
          </label>

          <label>
            專題說明
            <textarea v-model.trim="editForm.description" rows="4" required></textarea>
          </label>

          <div class="form-actions">
            <button type="submit">儲存</button>
            <button class="ghost" type="button" @click="cancelEditForm">取消</button>
          </div>
        </form>
      </section>

      <section v-if="group.relation === 'owned'" class="panel applications-panel">
        <div class="section-title">
          <h2>加入申請</h2>
          <p>審核同學送出的加入請求。</p>
        </div>

        <div class="applications-list">
          <div v-if="!applications.length" class="mini-item">目前沒有待審核申請</div>
          <div v-for="application in applications" :key="application.id" class="application-row">
            <span>
              <b>{{ application.applicant_name }}</b><br>
              <small>{{ application.applicant_email }}</small><br>
              {{ application.message || '沒有申請訊息' }}
            </span>
            <button class="ghost" type="button" @click="updateApplication(application, 'accepted')">接受</button>
            <button class="ghost" type="button" @click="updateApplication(application, 'rejected')">拒絕</button>
          </div>
        </div>
      </section>
    </div>

    <section v-if="canUseDiscussion" class="panel discussion-panel">
      <div class="section-title">
        <h2>群組討論</h2>
        <p>和已加入的成員同步進度與問題。</p>
      </div>

      <form class="comment-form" @submit.prevent="createComment">
        <input v-model.trim="commentContent" placeholder="輸入留言內容">
        <button type="submit">送出</button>
      </form>

      <div class="comments board-comments">
        <div v-if="!comments.length" class="comment">目前尚無留言</div>
        <div v-for="comment in comments" :key="comment.id" class="comment">
          <small class="message-author">{{ comment.user_name }}</small>
          <span class="message">{{ comment.content }}</span>
          <small class="message-time">{{ formatTime(comment.created_at) }}</small>
        </div>
      </div>
    </section>
  </main>

  <ToastMessage :message="toast" />
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'
import AppHeader from '../components/AppHeader.vue'
import ToastMessage from '../components/ToastMessage.vue'

const route = useRoute()
const router = useRouter()
const user = ref(JSON.parse(localStorage.getItem('teamup_user') || 'null'))
const group = ref(null)
const showEditForm = ref(false)
const applications = ref([])
const comments = ref([])
const commentContent = ref('')
const commentSignature = ref('')
const toast = ref('')
const editForm = reactive({
  title: '',
  course_name: '',
  teacher_name: '',
  current_members: 1,
  max_members: 4,
  status: 'open',
  required_skills: '',
  contact: '',
  accepting_applications: true,
  description: ''
})

const projectStatusLabels = {
  open: '開放中',
  full: '已滿員',
  closed: '已關閉'
}

const projectStatusOrder = ['open', 'full', 'closed']

const groupStatusText = computed(() => projectStatusLabels[group.value?.status] || '未知狀態')

const groupStatusClass = computed(() => group.value?.status || 'paused')

const editStatusText = computed(() => projectStatusLabels[editForm.status] || '未知狀態')

const editStatusClass = computed(() => editForm.status || 'paused')

const canUseDiscussion = computed(() => (
  group.value?.relation === 'owned' || group.value?.relation === 'joined'
))

const canShowMembershipAction = computed(() => (
  group.value?.relation === 'owned' ||
  group.value?.relation === 'joined' ||
  group.value?.relation === 'pending'
))

const membershipActionText = computed(() => {
  if (group.value?.relation === 'owned') {
    return '解散'
  }
  if (group.value?.relation === 'pending') {
    return '取消申請'
  }
  return '退出'
})

const relationLabel = computed(() => {
  if (group.value?.relation === 'owned') {
    return '擁有者'
  }
  if (group.value?.relation === 'pending') {
    return '申請審核中...'
  }
  return '成員'
})

let pollingTimer = 0
let toastTimer = 0

function showToast(message) {
  toast.value = message
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = ''
  }, 2400)
}

function fillEditForm(source) {
  Object.assign(editForm, {
    title: source.title || '',
    course_name: source.course_name || '',
    teacher_name: source.teacher_name || '',
    current_members: Number(source.current_members || 1),
    max_members: Number(source.max_members || 4),
    status: source.status || 'open',
    required_skills: source.required_skills || '',
    contact: source.contact || '',
    accepting_applications: Boolean(source.accepting_applications),
    description: source.description || ''
  })
}

async function loadUser() {
  const response = await api.get('/users/me')
  user.value = response.data.user
  localStorage.setItem('teamup_user', JSON.stringify(response.data.user))
}

async function loadGroup() {
  const response = await api.get(`/groups/${route.params.id}`)
  group.value = {
    ...response.data.group,
    accepting_applications: Boolean(response.data.group.accepting_applications)
  }
  fillEditForm(group.value)

  if (group.value.relation === 'owned') {
    await loadApplications()
  } else {
    applications.value = []
  }

  if (!canUseDiscussion.value) {
    comments.value = []
    commentSignature.value = ''
    stopPolling()
  }
}

async function loadApplications() {
  if (!group.value || group.value.relation !== 'owned') {
    applications.value = []
    return
  }

  const response = await api.get(`/projects/${group.value.id}/applications`)
  applications.value = response.data.applications || []
}

async function loadComments(silent = false) {
  if (!canUseDiscussion.value) {
    return
  }

  try {
    const response = await api.get(`/groups/${route.params.id}/comments`)
    const nextComments = response.data.comments || []
    const signature = nextComments.map((comment) => `${comment.id}:${comment.created_at}:${comment.content}`).join('|')
    if (signature !== commentSignature.value) {
      commentSignature.value = signature
      comments.value = nextComments
    }
  } catch (error) {
    if (!silent) {
      showToast(error.response?.data?.message || '留言載入失敗')
    }
  }
}

function startPolling() {
  stopPolling()
  pollingTimer = window.setInterval(() => {
    if (!document.hidden && canUseDiscussion.value) {
      loadComments(true)
    }
  }, 3000)
}

function stopPolling() {
  if (pollingTimer) {
    window.clearInterval(pollingTimer)
    pollingTimer = 0
  }
}

function toggleEditForm() {
  if (!showEditForm.value && group.value) {
    fillEditForm(group.value)
  }
  showEditForm.value = !showEditForm.value
}

function cancelEditForm() {
  if (group.value) {
    fillEditForm(group.value)
  }
  showEditForm.value = false
}

function cycleProjectStatus() {
  const currentIndex = projectStatusOrder.indexOf(editForm.status)
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % projectStatusOrder.length : 0
  editForm.status = projectStatusOrder[nextIndex]
}

async function saveProject() {
  try {
    await api.put(`/projects/${group.value.id}`, editForm)
    showEditForm.value = false
    showToast('專題資料已更新')
    await loadGroup()
  } catch (error) {
    showToast(error.response?.data?.message || '更新專題失敗')
  }
}

async function updateApplication(application, status) {
  try {
    await api.put(`/applications/${application.id}`, { status })
    showToast(status === 'accepted' ? '已接受申請' : '已拒絕申請')
    await loadGroup()
  } catch (error) {
    showToast(error.response?.data?.message || '更新申請失敗')
  }
}

async function handleMembershipAction() {
  if (!group.value) {
    return
  }

  const confirmed = window.confirm(
    group.value.relation === 'owned'
      ? '確定要解散這個群組嗎？'
      : group.value.relation === 'pending'
        ? '確定要取消這個申請嗎？'
        : '確定要退出這個群組嗎？'
  )
  if (!confirmed) {
    return
  }

  try {
    if (group.value.relation === 'owned') {
      await api.delete(`/projects/${group.value.id}`)
      showToast('已解散群組')
    } else {
      await api.delete(`/groups/${group.value.id}/membership`)
      showToast(group.value.relation === 'pending' ? '已取消申請' : '已退出群組')
    }

    window.setTimeout(() => {
      router.replace({ name: 'home' })
    }, 500)
  } catch (error) {
    showToast(error.response?.data?.message || '操作失敗')
  }
}

async function createComment() {
  if (!commentContent.value) {
    showToast('請輸入留言內容')
    return
  }

  try {
    await api.post(`/groups/${route.params.id}/comments`, {
      content: commentContent.value
    })
    commentContent.value = ''
    showToast('留言已送出')
    await loadComments()
  } catch (error) {
    showToast(error.response?.data?.message || '留言失敗')
  }
}

function formatTime(value) {
  if (!value) {
    return ''
  }

  let normalized = value.includes('T') ? value : value.replace(' ', 'T')
  if (!/[zZ]|[+-]\d\d:\d\d$/.test(normalized)) {
    normalized += 'Z'
  }

  const date = new Date(normalized)
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

async function logout() {
  localStorage.removeItem('teamup_token')
  localStorage.removeItem('teamup_user')
  await router.replace({ name: 'login' })
}

onMounted(async () => {
  try {
    await loadUser()
    await loadGroup()
    if (canUseDiscussion.value) {
      await loadComments()
      startPolling()
    }
  } catch (error) {
    showToast(error.response?.data?.message || '群組資料載入失敗')
    window.setTimeout(() => {
      router.replace({ name: 'home' })
    }, 900)
  }
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>
