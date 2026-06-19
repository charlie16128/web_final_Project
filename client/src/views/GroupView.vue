<template>
  <AppHeader :user="user" back-home @logout="logout" />

  <main class="group-layout" :class="{ 'public-group-layout': !canUseDiscussion }">
    <div v-if="group" ref="groupSideEl" class="group-side">
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
              <a
                v-if="group.github_url"
                class="github-link"
                :href="group.github_url"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open GitHub repository"
                title="GitHub Repo"
              >
                <svg class="github-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m12.301 0h.093c2.242 0 4.34.613 6.137 1.68l-.055-.031c1.871 1.094 3.386 2.609 4.449 4.422l.031.058c1.04 1.769 1.654 3.896 1.654 6.166 0 5.406-3.483 10-8.327 11.658l-.087.026c-.063.02-.135.031-.209.031-.162 0-.312-.054-.433-.144l.002.001c-.128-.115-.208-.281-.208-.466 0-.005 0-.01 0-.014v.001q0-.048.008-1.226t.008-2.154c.007-.075.011-.161.011-.249 0-.792-.323-1.508-.844-2.025.618-.061 1.176-.163 1.718-.305l-.076.017c.573-.16 1.073-.373 1.537-.642l-.031.017c.508-.28.938-.636 1.292-1.058l.006-.007c.372-.476.663-1.036.84-1.645l.009-.035c.209-.683.329-1.468.329-2.281 0-.045 0-.091-.001-.136v.007c0-.022.001-.047.001-.072 0-1.248-.482-2.383-1.269-3.23l.003.003c.168-.44.265-.948.265-1.479 0-.649-.145-1.263-.404-1.814l.011.026c-.115-.022-.246-.035-.381-.035-.334 0-.649.078-.929.216l.012-.005c-.568.21-1.054.448-1.512.726l.038-.022-.609.384c-.922-.264-1.981-.416-3.075-.416s-2.153.152-3.157.436l.081-.02q-.256-.176-.681-.433c-.373-.214-.814-.421-1.272-.595l-.066-.022c-.293-.154-.64-.244-1.009-.244-.124 0-.246.01-.364.03l.013-.002c-.248.524-.393 1.139-.393 1.788 0 .531.097 1.04.275 1.509l-.01-.029c-.785.844-1.266 1.979-1.266 3.227 0 .025 0 .051.001.076v-.004c-.001.039-.001.084-.001.13 0 .809.12 1.591.344 2.327l-.015-.057c.189.643.476 1.202.85 1.693l-.009-.013c.354.435.782.793 1.267 1.062l.022.011c.432.252.933.465 1.46.614l.046.011c.466.125 1.024.227 1.595.284l.046.004c-.431.428-.718 1-.784 1.638l-.001.012c-.207.101-.448.183-.699.236l-.021.004c-.256.051-.549.08-.85.08-.022 0-.044 0-.066 0h.003c-.394-.008-.756-.136-1.055-.348l.006.004c-.371-.259-.671-.595-.881-.986l-.007-.015c-.198-.336-.459-.614-.768-.827l-.009-.006c-.225-.169-.49-.301-.776-.38l-.016-.004-.32-.048c-.023-.002-.05-.003-.077-.003-.14 0-.273.028-.394.077l.007-.003q-.128.072-.08.184c.039.086.087.16.145.225l-.001-.001c.061.072.13.135.205.19l.003.002.112.08c.283.148.516.354.693.603l.004.006c.191.237.359.505.494.792l.01.024.16.368c.135.402.38.738.7.981l.005.004c.3.234.662.402 1.057.478l.016.002c.33.064.714.104 1.106.112h.007c.045.002.097.002.15.002.261 0 .517-.021.767-.062l-.027.004.368-.064q0 .609.008 1.418t.008.873v.014c0 .185-.08.351-.208.466h-.001c-.119.089-.268.143-.431.143-.075 0-.147-.011-.214-.032l.005.001c-4.929-1.689-8.409-6.283-8.409-11.69 0-2.268.612-4.393 1.681-6.219l-.032.058c1.094-1.871 2.609-3.386 4.422-4.449l.058-.031c1.739-1.034 3.835-1.645 6.073-1.645h.098-.005zm-7.64 17.666q.048-.112-.112-.192-.16-.048-.208.032-.048.112.112.192.144.096.208-.032zm.497.545q.112-.08-.032-.256-.160-.144-.256-.048-.112.08.032.256.159.157.256.047zm.48.72q.144-.112 0-.304-.128-.208-.272-.096-.144.08 0 .288t.272.112zm.672.673q.128-.128-.064-.304-.192-.192-.320-.048-.144.128.064.304.192.192.320.044zm.913.4q.048-.176-.208-.256-.240-.064-.304.112t.208.24q.240.097.304-.096zm1.009.08q0-.208-.272-.176-.256 0-.256.176 0 .208.272.176.256.001.256-.175zm.929-.16q-.032-.176-.288-.144-.256.048-.224.24t.288.128.225-.224z" />
                </svg>
              </a>
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
            <label data-error="*GitHub Repo 網址必須以 https://github.com/ 開頭">
              GitHub Repo
              <input
                v-model.trim="editForm.github_url"
                pattern="https://github\.com/.*"
                placeholder="https://github.com/owner/repo"
              >
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

      <section v-if="group" class="panel team-management-panel">
        <div class="section-title">
          <h2>{{ canManageGroupDetails ? '隊伍管理' : '成員列表' }}</h2>
          <p>{{ canManageGroupDetails ? '管理所有隊員、邀請新成員或轉移隊長。' : '查看目前隊伍成員。' }}</p>
        </div>

        <div v-if="canManageGroupDetails" class="team-management-actions team-management-grid">
          <button type="button" :disabled="isGroupFull" @click="inviteModalOpen = true">邀請成員</button>
          <button
            v-if="canTransferLeader"
            type="button"
            :disabled="!canTransferLeader || !transferableMembers.length"
            @click="transferModalOpen = true"
          >
            轉移隊長
          </button>
          <button
            v-if="canDeleteGroup"
            class="ghost danger delete-group-action"
            type="button"
            @click="deleteGroup"
          >
            刪除隊伍
          </button>
        </div>
        <p v-if="canManageGroupDetails && isGroupFull" class="mini-item">隊伍已額滿，無法再邀請新成員。</p>

        <div class="invite-list">
          <div v-for="member in members" :key="member.id" class="mini-item member-row">
            <span class="member-summary">
              <b><DisplayName :name="member.name" :role="member.role" /></b>
              <small
                class="group-role-badge"
                :class="groupRoleClass(member.group_role)"
              >
                {{ groupRoleLabel(member.group_role) }}
              </small>
            </span>
            <div class="member-role-actions">
              <button
                v-if="canSetViceLeader(member) && member.group_role !== 'vice_leader'"
                class="ghost compact-action role-action"
                type="button"
                @click="promoteMember(member)"
              >
                設為副隊長
              </button>
              <button
                v-if="canSetViceLeader(member) && member.group_role === 'vice_leader'"
                class="ghost compact-action role-action"
                type="button"
                @click="demoteMember(member)"
              >
                取消副隊長
              </button>
              <button
                v-if="canRemoveMember(member)"
                class="ghost danger compact-action"
                type="button"
                @click="removeMember(member)"
              >
                移除
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div v-if="canUseDiscussion" class="group-main">
      <CountdownBar
        :countdowns="countdowns"
        @add="openCreateCountdown"
        @open="openCountdownDetails"
      />

      <AnnouncementBar
        :announcements="announcements"
        :can-manage="canManageGroupDetails"
        @add="openCreateAnnouncement"
        @open="openAnnouncementDetails"
      />

      <section ref="discussionPanelEl" class="panel discussion-panel" :style="discussionPanelStyle">
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

  <CountdownModal
    v-if="countdownModalOpen"
    :mode="countdownModalMode"
    :countdown="selectedCountdown"
    :current-user-id="currentUserId"
    :can-manage="canManageGroupDetails"
    @close="closeCountdownModal"
    @create="createCountdown"
    @update="updateCountdown"
    @delete="deleteCountdown"
  />

  <AnnouncementModal
    v-if="announcementModalOpen"
    :mode="announcementModalMode"
    :announcement="selectedAnnouncement"
    :can-manage="canManageGroupDetails"
    @close="closeAnnouncementModal"
    @create="createAnnouncement"
    @update="updateAnnouncement"
    @delete="deleteAnnouncement"
  />

  <div v-if="inviteModalOpen" class="floating-modal-backdrop" @click.self="closeInviteModal">
    <section class="floating-modal team-management-modal">
      <div class="modal-head">
        <h2>邀請成員</h2>
        <button class="modal-close ghost" type="button" @click="closeInviteModal">x</button>
      </div>

      <form class="stack team-management-form invite-member-form" @submit.prevent="inviteMember">
        <label data-required data-error="*請輸入成員學號">
          成員學號
          <input
            v-model.trim="inviteForm.user_id"
            :disabled="isGroupFull"
            maxlength="8"
            pattern="D[0-9]{7}"
            placeholder="D1234567"
            @input="normalizeInviteUserId"
          >
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
          <CustomSelect
            v-model="transferForm.user_id"
            :options="transferMemberOptions"
            placeholder="選擇隊員"
          />
        </label>
        <div class="form-actions team-modal-actions">
          <button class="ghost team-modal-button" type="button" @click="closeTransferModal">取消</button>
          <button class="team-modal-button" type="submit" :disabled="!transferableMembers.length">轉移隊長</button>
        </div>
      </form>
    </section>
  </div>

  <AppDialog
    v-if="dialog.open"
    :title="dialog.title"
    :message="dialog.message"
    :confirm-text="dialog.confirmText"
    :cancel-text="dialog.cancelText"
    :show-cancel="dialog.showCancel"
    :danger="dialog.danger"
    :confirm-class="dialog.confirmClass"
    @confirm="confirmDialog"
    @cancel="cancelDialog"
  />

  <ToastMessage :message="toast" />
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'
import AnnouncementBar from '../components/AnnouncementBar.vue'
import AnnouncementModal from '../components/AnnouncementModal.vue'
import AppDialog from '../components/AppDialog.vue'
import AppHeader from '../components/AppHeader.vue'
import CountdownBar from '../components/CountdownBar.vue'
import CountdownModal from '../components/CountdownModal.vue'
import CustomSelect from '../components/common/CustomSelect.vue'
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
const countdowns = ref([])
const countdownModalOpen = ref(false)
const countdownModalMode = ref('view')
const selectedCountdown = ref(null)
const announcements = ref([])
const announcementModalOpen = ref(false)
const announcementModalMode = ref('view')
const selectedAnnouncement = ref(null)
const inviteModalOpen = ref(false)
const transferModalOpen = ref(false)
const reportCommentTarget = ref(null)
const toast = ref('')
const groupSideEl = ref(null)
const discussionPanelEl = ref(null)
const discussionPanelMaxHeight = ref('')

const editForm = reactive({
  title: '',
  course_name: '',
  teacher_name: '',
  current_members: 1,
  max_members: 4,
  required_skills: '',
  contact: '',
  github_url: '',
  accepting_applications: true,
  description: ''
})

const inviteForm = reactive({
  user_id: '',
  message: ''
})

const transferForm = reactive({
  user_id: ''
})

const dialog = reactive({
  open: false,
  title: '',
  message: '',
  confirmText: '確定',
  cancelText: '取消',
  showCancel: false,
  danger: false,
  confirmClass: '',
  resolve: null
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
  group.value?.relation === 'joined' ||
  group.value?.relation === 'pending'
))

const canManageGroupDetails = computed(() => (
  Boolean(group.value?.can_manage) ||
  group.value?.relation === 'owned' ||
  user.value?.role === 'admin' ||
  user.value?.role === 'super_admin'
))

const canTransferLeader = computed(() => (
  Boolean(group.value?.can_transfer_leader)
))

const canDeleteGroup = computed(() => (
  Boolean(group.value?.can_delete_group)
))

const currentUserId = computed(() => (
  user.value?.id || user.value?.student_id || ''
))

const isGroupFull = computed(() => (
  Number(group.value?.current_members || 0) >= Number(group.value?.max_members || 0)
))

const transferableMembers = computed(() => (
  members.value.filter((member) => member.relation === 'joined')
))

const transferMemberOptions = computed(() => (
  transferableMembers.value.map((member) => ({
    label: member.name,
    value: member.id
  }))
))

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
  if (group.value?.relation === 'joined') {
    return '已加入'
  }
  if (group.value?.relation === 'pending') {
    return '申請審核中'
  }
  if (group.value?.relation === 'admin') {
    return '管理員檢視'
  }
  return '尚未加入'
})

let pollingTimer = 0
let toastTimer = 0
let discussionResizeObserver = null
let discussionLayoutFrame = 0

const discussionPanelStyle = computed(() => (
  discussionPanelMaxHeight.value
    ? { '--discussion-panel-max-height': discussionPanelMaxHeight.value }
    : {}
))

function updateDiscussionPanelHeight() {
  if (
    !canUseDiscussion.value ||
    !groupSideEl.value ||
    !discussionPanelEl.value ||
    window.innerWidth <= 860
  ) {
    discussionPanelMaxHeight.value = ''
    return
  }

  const sideRect = groupSideEl.value.getBoundingClientRect()
  const panelRect = discussionPanelEl.value.getBoundingClientRect()
  const sideLimit = Math.floor(sideRect.bottom - panelRect.top)
  const viewportLimit = Math.floor(window.innerHeight - panelRect.top - 24)
  const nextHeight = Math.min(sideLimit, viewportLimit)

  discussionPanelMaxHeight.value = nextHeight >= 500 ? `${nextHeight}px` : ''
}

function scheduleDiscussionPanelHeightUpdate() {
  if (discussionLayoutFrame) {
    window.cancelAnimationFrame(discussionLayoutFrame)
  }

  discussionLayoutFrame = window.requestAnimationFrame(() => {
    discussionLayoutFrame = 0
    updateDiscussionPanelHeight()
  })
}

function startDiscussionLayoutObserver() {
  stopDiscussionLayoutObserver()

  if (typeof ResizeObserver !== 'undefined' && groupSideEl.value) {
    discussionResizeObserver = new ResizeObserver(scheduleDiscussionPanelHeightUpdate)
    discussionResizeObserver.observe(groupSideEl.value)
  }

  window.addEventListener('resize', scheduleDiscussionPanelHeightUpdate)
  scheduleDiscussionPanelHeightUpdate()
}

function stopDiscussionLayoutObserver() {
  if (discussionResizeObserver) {
    discussionResizeObserver.disconnect()
    discussionResizeObserver = null
  }

  if (discussionLayoutFrame) {
    window.cancelAnimationFrame(discussionLayoutFrame)
    discussionLayoutFrame = 0
  }

  window.removeEventListener('resize', scheduleDiscussionPanelHeightUpdate)
  discussionPanelMaxHeight.value = ''
}

function showToast(message) {
  toast.value = message
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = ''
  }, 2400)
}

function requestDialog(options) {
  return new Promise((resolve) => {
    Object.assign(dialog, {
      open: true,
      title: options.title || '訊息',
      message: options.message,
      confirmText: options.confirmText || '確定',
      cancelText: options.cancelText || '取消',
      showCancel: Boolean(options.showCancel),
      danger: Boolean(options.danger),
      confirmClass: options.confirmClass || '',
      resolve
    })
  })
}

function requestConfirmation(options) {
  return requestDialog({
    ...options,
    showCancel: true
  })
}

function resetDialog() {
  Object.assign(dialog, {
    open: false,
    title: '',
    message: '',
    confirmText: '確定',
    cancelText: '取消',
    showCancel: false,
    danger: false,
    confirmClass: '',
    resolve: null
  })
}

function confirmDialog() {
  const resolve = dialog.resolve
  resetDialog()
  resolve?.(true)
}

function cancelDialog() {
  const resolve = dialog.resolve
  resetDialog()
  resolve?.(false)
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
    github_url: source.github_url || '',
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

function normalizeInviteUserId() {
  inviteForm.user_id = inviteForm.user_id
    .toUpperCase()
    .replace(/[^D0-9]/g, '')
    .slice(0, 8)
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

  await loadMembers()

  if (canManageGroupDetails.value) {
    await loadApplications()
  } else {
    applications.value = []
  }

  if (canUseDiscussion.value) {
    await Promise.all([loadCountdowns(), loadAnnouncements()])
  } else {
    countdowns.value = []
    announcements.value = []
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
  if (!group.value) {
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

async function loadCountdowns() {
  const response = await api.get(`/groups/${route.params.id}/countdowns`)
  countdowns.value = response.data.countdowns || []
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
    await api.patch(`/groups/${group.value.id}`, {
      title: editForm.title,
      course_name: editForm.course_name,
      teacher_name: editForm.teacher_name,
      max_members: editForm.max_members,
      required_skills: editForm.required_skills,
      contact: editForm.contact,
      github_url: editForm.github_url,
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
  normalizeInviteUserId()
  if (!inviteForm.user_id) {
    showToast('請輸入成員學號')
    return
  }
  if (!/^D[0-9]{7}$/.test(inviteForm.user_id)) {
    showToast('學號格式必須為 D 加 7 位數字，例如 D1234567')
    return
  }

  try {
    await api.post(`/groups/${group.value.id}/invitations`, {
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

function openCreateCountdown() {
  selectedCountdown.value = null
  countdownModalMode.value = 'create'
  countdownModalOpen.value = true
}

function openCountdownDetails(countdown) {
  selectedCountdown.value = countdown
  countdownModalMode.value = 'view'
  countdownModalOpen.value = true
}

function closeCountdownModal() {
  countdownModalOpen.value = false
  selectedCountdown.value = null
  countdownModalMode.value = 'view'
}

async function createCountdown(payload) {
  try {
    await api.post(`/groups/${route.params.id}/countdowns`, payload)
    showToast('倒數已新增')
    closeCountdownModal()
    await loadCountdowns()
  } catch (error) {
    showToast(error.response?.data?.message || '新增倒數失敗')
  }
}

async function updateCountdown(countdown, payload) {
  try {
    await api.patch(`/groups/${route.params.id}/countdowns/${countdown.id}`, payload)
    showToast('倒數已更新')
    closeCountdownModal()
    await loadCountdowns()
  } catch (error) {
    showToast(error.response?.data?.message || '更新倒數失敗')
  }
}

async function deleteCountdown(countdown) {
  const confirmed = await requestConfirmation({
    title: '刪除倒數',
    message: '確定要刪除此倒數嗎？',
    confirmText: '刪除',
    danger: true
  })
  if (!confirmed) {
    return
  }

  try {
    await api.delete(`/groups/${route.params.id}/countdowns/${countdown.id}`)
    showToast('倒數已刪除')
    closeCountdownModal()
    await loadCountdowns()
  } catch (error) {
    showToast(error.response?.data?.message || '刪除倒數失敗')
  }
}

function groupRoleLabel(role) {
  if (role === 'leader') {
    return '隊長'
  }
  if (role === 'vice_leader') {
    return '副隊長'
  }
  if (role === 'admin') {
    return '管理員'
  }
  if (role === 'invited') {
    return '已邀請'
  }
  return '隊員'
}

function groupRoleClass(role) {
  return `role-${role || 'member'}`
}

function canSetViceLeader(member) {
  return group.value?.group_role === 'leader' && member.relation === 'joined'
}

function canRemoveMember(member) {
  if (member.relation !== 'joined' || !canManageGroupDetails.value) {
    return false
  }
  if (group.value?.group_role === 'vice_leader' && member.group_role === 'vice_leader') {
    return false
  }
  return true
}

async function updateMemberRole(member, role) {
  try {
    await api.patch(`/groups/${group.value.id}/members/${member.id}/role`, { role })
    showToast(role === 'vice_leader' ? '已設為副隊長' : '已取消副隊長')
    await loadGroup()
  } catch (error) {
    showToast(error.response?.data?.message || '更新隊伍角色失敗')
  }
}

function promoteMember(member) {
  return updateMemberRole(member, 'vice_leader')
}

function demoteMember(member) {
  return updateMemberRole(member, 'member')
}

async function transferOwner() {
  if (!transferForm.user_id) {
    showToast('請選擇新隊長')
    return
  }
  const confirmed = await requestConfirmation({
    title: '轉移隊長',
    message: '確定要轉移隊長嗎？',
    confirmText: '轉移',
    danger: true
  })
  if (!confirmed) {
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
  const confirmed = await requestConfirmation({
    title: '移除隊員',
    message: `確定要將 ${member.name} 移出隊伍嗎？`,
    confirmText: '移除',
    confirmClass: 'confirm-danger-action'
  })
  if (!confirmed) {
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

function openCreateAnnouncement() {
  selectedAnnouncement.value = null
  announcementModalMode.value = 'create'
  announcementModalOpen.value = true
}

function openAnnouncementDetails(announcement) {
  selectedAnnouncement.value = announcement
  announcementModalMode.value = 'view'
  announcementModalOpen.value = true
}

function closeAnnouncementModal() {
  announcementModalOpen.value = false
  selectedAnnouncement.value = null
  announcementModalMode.value = 'view'
}

async function createAnnouncement(payload) {
  try {
    await api.post(`/groups/${route.params.id}/announcements`, payload)
    showToast('公告已新增')
    closeAnnouncementModal()
    await loadAnnouncements()
  } catch (error) {
    showToast(error.response?.data?.message || '公告儲存失敗')
  }
}

async function updateAnnouncement(announcement, payload) {
  try {
    await api.put(`/groups/${route.params.id}/announcements/${announcement.id}`, payload)
    showToast('公告已更新')
    closeAnnouncementModal()
    await loadAnnouncements()
  } catch (error) {
    showToast(error.response?.data?.message || '公告儲存失敗')
  }
}

async function deleteAnnouncement(announcement) {
  const confirmed = await requestConfirmation({
    title: '刪除公告',
    message: '確定要刪除這則公告嗎？',
    confirmText: '刪除',
    danger: true
  })
  if (!confirmed) {
    return
  }

  try {
    await api.delete(`/groups/${route.params.id}/announcements/${announcement.id}`)
    showToast('公告已刪除')
    closeAnnouncementModal()
    await loadAnnouncements()
  } catch (error) {
    showToast(error.response?.data?.message || '公告刪除失敗')
  }
}

async function handleMembershipAction() {
  if (!group.value) {
    return
  }

  const message = group.value.relation === 'owned'
    ? '確定要刪除這個隊伍嗎？'
    : group.value.relation === 'pending'
      ? '確定要取消申請嗎？'
      : '確定要退出隊伍嗎？'
  const confirmed = await requestConfirmation({
    title: '確認操作',
    message,
    confirmText: '確定',
    danger: group.value.relation === 'owned'
  })
  if (!confirmed) {
    return
  }

  try {
    if (group.value.relation === 'owned') {
      await api.delete(`/groups/${group.value.id}`)
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

async function deleteGroup() {
  if (!group.value) {
    return
  }

  const confirmed = await requestConfirmation({
    title: '刪除隊伍',
    message: '確定要刪除這個隊伍嗎？此操作無法復原。',
    confirmText: '刪除',
    danger: true
  })
  if (!confirmed) {
    return
  }

  try {
    await api.delete(`/groups/${group.value.id}`)
    showToast('隊伍已刪除')
    window.setTimeout(() => {
      router.replace({ name: 'home' })
    }, 500)
  } catch (error) {
    showToast(error.response?.data?.message || '刪除隊伍失敗')
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

watch(
  () => [
    canUseDiscussion.value,
    showEditForm.value,
    members.value.length,
    applications.value.length,
    countdowns.value.length,
    announcements.value.length
  ],
  async () => {
    await nextTick()
    if (canUseDiscussion.value) {
      startDiscussionLayoutObserver()
    } else {
      stopDiscussionLayoutObserver()
    }
  },
  { flush: 'post' }
)

onMounted(async () => {
  try {
    await loadUser()
    await loadGroup()
    if (canUseDiscussion.value) {
      await loadComments()
      startPolling()
      await nextTick()
      startDiscussionLayoutObserver()
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
  stopDiscussionLayoutObserver()
})
</script>
