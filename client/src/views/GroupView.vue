<template>
  <AppHeader :user="user" back-home @logout="logout" />

  <main class="group-layout">
    <div v-if="group" class="group-side">
      <section class="panel group-detail">
        <template v-if="!showEditForm">
          <div class="project-head">
            <div>
              <p class="eyebrow">隊伍狀態：{{ relationLabel }}</p>
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
                {{ group.teacher_name || '未填老師' }} /
                隊長：<DisplayName :name="group.owner_name" :role="group.owner_role" />
              </div>
            </div>
            <div class="badge-stack">
              <span class="badge" :class="groupStatusClass">{{ groupStatusText }}</span>
            </div>
          </div>

          <dl class="detail-grid">
            <div>
              <dt>隊伍名稱</dt>
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
            <h3>隊伍說明</h3>
            <textarea v-model.trim="editForm.description" rows="4" readonly></textarea>
          </section>

          <button
            v-if="canManageGroupDetails"
            class="full-width"
            type="button"
            @click="toggleEditForm"
          >
            編輯隊伍資料
          </button>
        </template>

        <form v-else class="group-edit-form" @submit.prevent="saveProject">
          <div class="project-head">
            <div>
              <p class="eyebrow">編輯隊伍資料</p>
              <label data-required data-error="*請輸入隊伍名稱">
                隊伍名稱
                <input v-model.trim="editForm.title">
              </label>
              <div class="grid-form compact-fields">
                <label>
                  課程名稱
                  <input v-model.trim="editForm.course_name">
                </label>
                <label>
                  授課老師
                  <input v-model.trim="editForm.teacher_name">
                </label>
              </div>
            </div>
          </div>

          <div class="detail-grid edit-detail-grid">
            <label>
              目前人數
              <input :value="group.current_members" disabled>
            </label>
            <label data-required data-error="*請輸入人數上限">
              人數上限
              <input v-model.number="editForm.max_members" type="number" min="2">
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
            <span>開放申請加入</span>
          </label>

          <label data-required data-error="*請輸入隊伍說明">
            隊伍說明
            <textarea v-model.trim="editForm.description" rows="4"></textarea>
          </label>

          <div class="form-actions">
            <button type="submit">儲存</button>
            <button class="ghost" type="button" @click="cancelEditForm">取消</button>
          </div>
        </form>
      </section>

      <section v-if="canManageGroupDetails" class="panel applications-panel">
        <div class="section-title">
          <h2>加入申請</h2>
          <p>審核想加入此隊伍的同學。</p>
        </div>

        <div class="applications-list">
          <div v-if="!applications.length" class="mini-item">目前沒有待審核申請</div>
          <div v-for="application in applications" :key="application.id" class="application-row">
            <span>
              <b><DisplayName :name="application.applicant_name" :role="application.applicant_role" /></b><br>
              <small>{{ application.applicant_email }}</small><br>
              {{ application.message || '沒有申請訊息' }}
            </span>
            <button class="ghost" type="button" @click="updateApplication(application, 'accepted')">接受</button>
            <button class="ghost" type="button" @click="updateApplication(application, 'rejected')">拒絕</button>
          </div>
        </div>
      </section>

      <section v-if="canManageGroupDetails" class="panel team-management-panel">
        <div class="section-title">
          <h2>隊伍管理</h2>
          <p>管理所有隊員、邀請新成員或轉移隊長。</p>
        </div>

        <div class="team-management-actions team-management-grid">
          <button type="button" :disabled="isGroupFull" @click="inviteModalOpen = true">邀請成員</button>
          <button type="button" :disabled="!transferableMembers.length" @click="transferModalOpen = true">轉移隊長</button>
        </div>
        <p v-if="isGroupFull" class="mini-item">隊伍已額滿，無法再邀請新成員。</p>

        <div class="invite-list">
          <div v-for="member in members" :key="member.id" class="mini-item member-row">
            <span>
              <b><DisplayName :name="member.name" :role="member.role" /></b>
              <small>{{ member.relation === 'owned' ? '隊長' : '隊員' }}</small>
            </span>
            <button
              v-if="member.relation === 'joined'"
              class="ghost danger compact-action"
              type="button"
              @click="removeMember(member)"
            >
              移除
            </button>
          </div>
        </div>
      </section>
    </div>

    <div v-if="canUseDiscussion" class="group-main">
      <button
        class="summary-strip announcement-summary"
        type="button"
        @click="announcementModalOpen = true"
      >
        {{ announcementSummary }}
      </button>

      <button
        class="summary-strip deadline-summary"
        type="button"
        @click="deadlineModalOpen = true"
      >
        {{ deadlineSummary }}
      </button>

      <section class="panel discussion-panel">
        <div class="section-title">
          <h2>隊伍討論</h2>
          <p>隊員可以在這裡留言與回覆。</p>
        </div>

        <form class="comment-form" @submit.prevent="createComment">
          <label data-required class="inline-field" data-error="*請輸入留言">
            <input v-model.trim="commentContent" placeholder="輸入留言">
          </label>
          <button type="submit">送出</button>
        </form>

        <div class="comments board-comments">
          <div v-if="!comments.length" class="comment">目前沒有留言</div>
          <div v-for="comment in comments" :key="comment.id" class="comment">
            <small class="message-author"><DisplayName :name="comment.user_name" :role="comment.user_role" /></small>
            <span class="message">{{ comment.content }}</span>
            <div class="message-footer">
              <small class="message-time">{{ formatTime(comment.created_at) }}</small>
              <button class="ghost compact-action" type="button" @click="replyToComment(comment)">回覆</button>
              <button class="ghost danger compact-action" type="button" @click="openReportComment(comment)">檢舉</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>

  <FloatingInputModal
    v-if="reportCommentTarget"
    title="檢舉留言"
    label="檢舉訊息"
    placeholder="請輸入檢舉原因"
    submit-text="送出檢舉"
    @close="reportCommentTarget = null"
    @submit="submitCommentReport"
  />

  <div v-if="announcementModalOpen" class="floating-modal-backdrop" @click.self="announcementModalOpen = false">
    <section class="floating-modal">
      <div class="modal-head">
        <h2>公告</h2>
        <button class="modal-close ghost" type="button" @click="announcementModalOpen = false">x</button>
      </div>

      <form v-if="canManageGroupDetails" class="stack" @submit.prevent="saveAnnouncement">
        <label data-required data-error="*請輸入公告內容">
          公告內容
          <textarea v-model.trim="announcementForm.content" rows="4" placeholder="輸入公告內容"></textarea>
        </label>
        <div class="form-actions">
          <button type="submit">{{ announcementForm.id ? '更新公告' : '新增公告' }}</button>
          <button v-if="announcementForm.id" class="ghost" type="button" @click="resetAnnouncementForm">取消編輯</button>
        </div>
      </form>

      <div class="modal-list">
        <article v-if="!announcements.length" class="mini-item">目前沒有公告</article>
        <article v-for="announcement in announcements" :key="announcement.id" class="modal-item">
          <p>{{ announcement.content }}</p>
          <small>
            <DisplayName :name="announcement.author_name" :role="announcement.author_role" />
            ｜ {{ formatTime(announcement.updated_at || announcement.created_at) }}
          </small>
          <div v-if="canManageGroupDetails" class="inline-actions">
            <button class="ghost compact-action" type="button" @click="editAnnouncement(announcement)">編輯</button>
            <button class="ghost danger compact-action" type="button" @click="deleteAnnouncement(announcement)">刪除</button>
          </div>
        </article>
      </div>
    </section>
  </div>

  <div v-if="deadlineModalOpen" class="floating-modal-backdrop" @click.self="deadlineModalOpen = false">
    <section class="floating-modal">
      <div class="modal-head">
        <h2>倒數日期</h2>
        <button class="modal-close ghost" type="button" @click="deadlineModalOpen = false">x</button>
      </div>

      <form v-if="canManageGroupDetails" class="stack" @submit.prevent="saveDeadline">
        <div class="grid-form compact-fields">
          <label data-required data-error="*請輸入倒數日期標題">
            標題
            <input v-model.trim="deadlineForm.title">
          </label>
          <label data-required data-error="*請選擇日期">
            日期
            <input v-model="deadlineForm.deadline_date" type="date">
          </label>
        </div>
        <label>
          說明
          <textarea v-model.trim="deadlineForm.description" rows="3" placeholder="補充說明"></textarea>
        </label>
        <div class="form-actions">
          <button type="submit">{{ deadlineForm.id ? '更新倒數日期' : '新增倒數日期' }}</button>
          <button v-if="deadlineForm.id" class="ghost" type="button" @click="resetDeadlineForm">取消編輯</button>
        </div>
      </form>

      <div class="modal-list">
        <article v-if="!deadlines.length" class="mini-item">目前沒有倒數日期</article>
        <article v-for="deadline in deadlines" :key="deadline.id" class="modal-item">
          <div class="deadline-row">
            <strong>{{ deadline.title }}</strong>
            <span>{{ deadline.deadline_date }} ｜ {{ daysRemainingText(deadline.deadline_date) }}</span>
          </div>
          <p v-if="deadline.description">{{ deadline.description }}</p>
          <div v-if="canManageGroupDetails" class="inline-actions">
            <button class="ghost compact-action" type="button" @click="editDeadline(deadline)">編輯</button>
            <button class="ghost danger compact-action" type="button" @click="deleteDeadline(deadline)">刪除</button>
          </div>
        </article>
      </div>
    </section>
  </div>

  <div v-if="inviteModalOpen" class="floating-modal-backdrop" @click.self="closeInviteModal">
    <section class="floating-modal team-management-modal">
      <div class="modal-head">
        <h2>邀請成員</h2>
        <button class="modal-close ghost" type="button" @click="closeInviteModal">x</button>
      </div>

      <form class="stack team-management-form invite-member-form" @submit.prevent="inviteMember">
        <label data-required data-error="*請輸入成員學號">
          成員學號
          <input v-model.trim="inviteForm.user_id" :disabled="isGroupFull">
        </label>
        <label>
          邀請訊息
          <textarea v-model.trim="inviteForm.message" rows="3" :disabled="isGroupFull" placeholder="可輸入邀請說明"></textarea>
        </label>
        <div class="form-actions team-modal-actions">
          <button class="ghost team-modal-button" type="button" @click="closeInviteModal">取消</button>
          <button class="team-modal-button" type="submit" :disabled="isGroupFull">送出邀請</button>
        </div>
      </form>
    </section>
  </div>

  <div v-if="transferModalOpen" class="floating-modal-backdrop" @click.self="closeTransferModal">
    <section class="floating-modal team-management-modal">
      <div class="modal-head">
        <h2>轉移隊長</h2>
        <button class="modal-close ghost" type="button" @click="closeTransferModal">x</button>
      </div>

      <form class="stack team-management-form transfer-owner-form" @submit.prevent="transferOwner">
        <label data-required data-error="*請選擇成員">
          新隊長
          <select v-model="transferForm.user_id">
            <option value="" disabled>選擇隊員</option>
            <option v-for="member in transferableMembers" :key="member.id" :value="member.id">
              {{ member.name }}
            </option>
          </select>
        </label>
        <div class="form-actions team-modal-actions">
          <button class="ghost team-modal-button" type="button" @click="closeTransferModal">取消</button>
          <button class="team-modal-button" type="submit" :disabled="!transferableMembers.length">轉移隊長</button>
        </div>
      </form>
    </section>
  </div>

  <ToastMessage :message="toast" />
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'
import AppHeader from '../components/AppHeader.vue'
import DisplayName from '../components/DisplayName.vue'
import FloatingInputModal from '../components/FloatingInputModal.vue'
import ToastMessage from '../components/ToastMessage.vue'

const route = useRoute()
const router = useRouter()
const user = ref(JSON.parse(localStorage.getItem('teamup_user') || 'null'))
const group = ref(null)
const showEditForm = ref(false)
const applications = ref([])
const members = ref([])
const comments = ref([])
const commentContent = ref('')
const commentSignature = ref('')
const announcements = ref([])
const deadlines = ref([])
const announcementModalOpen = ref(false)
const deadlineModalOpen = ref(false)
const inviteModalOpen = ref(false)
const transferModalOpen = ref(false)
const reportCommentTarget = ref(null)
const toast = ref('')

const editForm = reactive({
  title: '',
  course_name: '',
  teacher_name: '',
  current_members: 1,
  max_members: 4,
  required_skills: '',
  contact: '',
  accepting_applications: true,
  description: ''
})

const announcementForm = reactive({
  id: null,
  content: ''
})

const deadlineForm = reactive({
  id: null,
  title: '',
  deadline_date: '',
  description: ''
})

const inviteForm = reactive({
  user_id: '',
  message: ''
})

const transferForm = reactive({
  user_id: ''
})

const groupStatusText = computed(() => {
  if (isGroupFull.value) {
    return '已額滿'
  }
  return group.value?.accepting_applications ? '招募中' : '暫停申請'
})

const groupStatusClass = computed(() => {
  if (isGroupFull.value) {
    return 'full'
  }
  return group.value?.accepting_applications ? 'open' : 'paused'
})

const canUseDiscussion = computed(() => (
  Boolean(group.value?.can_view_private_area) ||
  group.value?.relation === 'owned' ||
  group.value?.relation === 'joined' ||
  group.value?.relation === 'admin'
))

const canShowMembershipAction = computed(() => (
  group.value?.relation === 'owned' ||
  group.value?.relation === 'joined' ||
  group.value?.relation === 'pending'
))

const canManageGroupDetails = computed(() => (
  Boolean(group.value?.can_manage) ||
  group.value?.relation === 'owned' ||
  user.value?.role === 'admin' ||
  user.value?.role === 'super_admin'
))

const isGroupFull = computed(() => (
  Number(group.value?.current_members || 0) >= Number(group.value?.max_members || 0)
))

const transferableMembers = computed(() => (
  members.value.filter((member) => member.relation === 'joined')
))

const announcementSummary = computed(() => {
  if (!announcements.value.length) {
    return '目前沒有公告'
  }
  return `公告：${announcements.value[0].content}`
})

const deadlineSummary = computed(() => {
  if (!deadlines.value.length) {
    return '目前沒有倒數日期'
  }
  const deadline = deadlines.value[0]
  return `${deadline.title}：${daysRemainingText(deadline.deadline_date)}`
})

const membershipActionText = computed(() => {
  if (group.value?.relation === 'owned') {
    return '刪除隊伍'
  }
  if (group.value?.relation === 'pending') {
    return '取消申請'
  }
  return '退出隊伍'
})

const relationLabel = computed(() => {
  if (group.value?.relation === 'owned') {
    return '我是隊長'
  }
  if (group.value?.relation === 'pending') {
    return '申請審核中'
  }
  if (group.value?.relation === 'admin') {
    return '管理員檢視'
  }
  return '已加入'
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
    required_skills: source.required_skills || '',
    contact: source.contact || '',
    accepting_applications: Boolean(source.accepting_applications),
    description: source.description || ''
  })
}

function resetInviteForm() {
  inviteForm.user_id = ''
  inviteForm.message = ''
}

function resetTransferForm() {
  transferForm.user_id = ''
}

function closeInviteModal() {
  inviteModalOpen.value = false
  resetInviteForm()
}

function closeTransferModal() {
  transferModalOpen.value = false
  resetTransferForm()
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

  if (canManageGroupDetails.value) {
    await Promise.all([loadApplications(), loadMembers()])
  } else {
    applications.value = []
    members.value = []
  }

  if (canUseDiscussion.value) {
    await Promise.all([loadAnnouncements(), loadDeadlines()])
  } else {
    announcements.value = []
    deadlines.value = []
    comments.value = []
    commentSignature.value = ''
    stopPolling()
  }
}

async function loadApplications() {
  if (!group.value || !canManageGroupDetails.value) {
    applications.value = []
    return
  }

  const response = await api.get(`/projects/${group.value.id}/applications`)
  applications.value = response.data.applications || []
}

async function loadMembers() {
  if (!group.value || !canManageGroupDetails.value) {
    members.value = []
    return
  }

  const response = await api.get(`/groups/${route.params.id}/members`)
  members.value = response.data.members || []
}

async function loadAnnouncements() {
  const response = await api.get(`/groups/${route.params.id}/announcements`)
  announcements.value = response.data.announcements || []
}

async function loadDeadlines() {
  const response = await api.get(`/groups/${route.params.id}/deadlines`)
  deadlines.value = response.data.deadlines || []
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

async function saveProject() {
  try {
    await api.put(`/projects/${group.value.id}`, {
      title: editForm.title,
      course_name: editForm.course_name,
      teacher_name: editForm.teacher_name,
      max_members: editForm.max_members,
      required_skills: editForm.required_skills,
      contact: editForm.contact,
      accepting_applications: editForm.accepting_applications,
      description: editForm.description
    })
    showEditForm.value = false
    showToast('隊伍資料已更新')
    await loadGroup()
  } catch (error) {
    showToast(error.response?.data?.message || '更新隊伍失敗')
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

async function inviteMember() {
  if (isGroupFull.value) {
    showToast('隊伍已額滿，無法邀請')
    return
  }
  if (!inviteForm.user_id) {
    showToast('請輸入成員學號')
    return
  }

  try {
    await api.post(`/projects/${group.value.id}/invitations`, {
      user_id: inviteForm.user_id,
      message: inviteForm.message
    })
    closeInviteModal()
    showToast('邀請已送出')
    await loadGroup()
  } catch (error) {
    showToast(error.response?.data?.message || '送出邀請失敗')
  }
}

async function transferOwner() {
  if (!transferForm.user_id) {
    showToast('請選擇新隊長')
    return
  }
  if (!window.confirm('確定要轉移隊長嗎？')) {
    return
  }

  try {
    await api.post(`/projects/${group.value.id}/transfer-owner`, {
      user_id: transferForm.user_id
    })
    closeTransferModal()
    showToast('隊長已轉移')
    await loadGroup()
  } catch (error) {
    showToast(error.response?.data?.message || '轉移隊長失敗')
  }
}

async function removeMember(member) {
  if (!window.confirm(`確定要將 ${member.name} 移出隊伍嗎？`)) {
    return
  }

  try {
    await api.delete(`/groups/${group.value.id}/members/${member.id}`)
    showToast('隊員已移除')
    await loadGroup()
  } catch (error) {
    showToast(error.response?.data?.message || '移除隊員失敗')
  }
}

async function saveAnnouncement() {
  if (!announcementForm.content) {
    showToast('請輸入公告內容')
    return
  }

  try {
    if (announcementForm.id) {
      await api.put(`/groups/${route.params.id}/announcements/${announcementForm.id}`, {
        content: announcementForm.content
      })
      showToast('公告已更新')
    } else {
      await api.post(`/groups/${route.params.id}/announcements`, {
        content: announcementForm.content
      })
      showToast('公告已新增')
    }
    resetAnnouncementForm()
    await loadAnnouncements()
  } catch (error) {
    showToast(error.response?.data?.message || '公告儲存失敗')
  }
}

function editAnnouncement(announcement) {
  announcementForm.id = announcement.id
  announcementForm.content = announcement.content
}

function resetAnnouncementForm() {
  announcementForm.id = null
  announcementForm.content = ''
}

async function deleteAnnouncement(announcement) {
  if (!window.confirm('確定要刪除這則公告嗎？')) {
    return
  }

  try {
    await api.delete(`/groups/${route.params.id}/announcements/${announcement.id}`)
    if (announcementForm.id === announcement.id) {
      resetAnnouncementForm()
    }
    showToast('公告已刪除')
    await loadAnnouncements()
  } catch (error) {
    showToast(error.response?.data?.message || '公告刪除失敗')
  }
}

async function saveDeadline() {
  if (!deadlineForm.title || !deadlineForm.deadline_date) {
    showToast('請輸入倒數日期標題與日期')
    return
  }

  const payload = {
    title: deadlineForm.title,
    deadline_date: deadlineForm.deadline_date,
    description: deadlineForm.description
  }

  try {
    if (deadlineForm.id) {
      await api.put(`/groups/${route.params.id}/deadlines/${deadlineForm.id}`, payload)
      showToast('倒數日期已更新')
    } else {
      await api.post(`/groups/${route.params.id}/deadlines`, payload)
      showToast('倒數日期已新增')
    }
    resetDeadlineForm()
    await loadDeadlines()
  } catch (error) {
    showToast(error.response?.data?.message || '倒數日期儲存失敗')
  }
}

function editDeadline(deadline) {
  deadlineForm.id = deadline.id
  deadlineForm.title = deadline.title
  deadlineForm.deadline_date = deadline.deadline_date
  deadlineForm.description = deadline.description || ''
}

function resetDeadlineForm() {
  deadlineForm.id = null
  deadlineForm.title = ''
  deadlineForm.deadline_date = ''
  deadlineForm.description = ''
}

async function deleteDeadline(deadline) {
  if (!window.confirm('確定要刪除這個倒數日期嗎？')) {
    return
  }

  try {
    await api.delete(`/groups/${route.params.id}/deadlines/${deadline.id}`)
    if (deadlineForm.id === deadline.id) {
      resetDeadlineForm()
    }
    showToast('倒數日期已刪除')
    await loadDeadlines()
  } catch (error) {
    showToast(error.response?.data?.message || '倒數日期刪除失敗')
  }
}

async function handleMembershipAction() {
  if (!group.value) {
    return
  }

  const confirmed = window.confirm(
    group.value.relation === 'owned'
      ? '確定要刪除這個隊伍嗎？'
      : group.value.relation === 'pending'
        ? '確定要取消申請嗎？'
        : '確定要退出隊伍嗎？'
  )
  if (!confirmed) {
    return
  }

  try {
    if (group.value.relation === 'owned') {
      await api.delete(`/projects/${group.value.id}`)
      showToast('隊伍已刪除')
    } else {
      await api.delete(`/groups/${group.value.id}/membership`)
      showToast(group.value.relation === 'pending' ? '已取消申請' : '已退出隊伍')
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
    showToast('請輸入留言')
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
    showToast(error.response?.data?.message || '留言送出失敗')
  }
}

function replyToComment(comment) {
  const name = comment.user_name || '隊員'
  commentContent.value = `@${name} ${commentContent.value || ''}`.trimStart()
}

function openReportComment(comment) {
  reportCommentTarget.value = comment
}

async function submitCommentReport(payload) {
  if (!reportCommentTarget.value || !group.value) {
    return
  }

  try {
    await api.post('/reports', {
      target_user_id: reportCommentTarget.value.user_id,
      target_project_id: group.value.id,
      target_comment_id: reportCommentTarget.value.id,
      reason: payload.message,
      detail: ''
    })
    reportCommentTarget.value = null
    showToast('檢舉已送出，管理員會盡快處理')
  } catch (error) {
    showToast(error.response?.data?.message || '檢舉送出失敗')
  }
}

function daysRemainingText(value) {
  if (!value) {
    return ''
  }

  const deadlineDate = new Date(`${value}T00:00:00`)
  if (Number.isNaN(deadlineDate.getTime())) {
    return value
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.ceil((deadlineDate - today) / 86400000)

  if (days === 0) {
    return '今天到期'
  }
  if (days > 0) {
    return `剩 ${days} 天`
  }
  return `已逾期 ${Math.abs(days)} 天`
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
    showToast(error.response?.data?.message || '隊伍資料載入失敗')
    window.setTimeout(() => {
      router.replace({ name: 'home' })
    }, 900)
  }
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>
