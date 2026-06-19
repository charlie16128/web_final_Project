<template>
  <article class="project-card">
    <div class="project-head">
      <div>
        <h3>
          <RouterLink class="project-title-link" :to="{ name: 'group', params: { id: project.id } }">
            {{ project.title }}
          </RouterLink>
        </h3>
        <div class="meta">
          {{ project.course_name || '未填課程' }} |
          {{ project.teacher_name || '未填老師' }} |
          建立者 <DisplayName :name="project.owner_name" :role="project.owner_role" />
        </div>
      </div>

      <div class="badge-stack">
        <span class="badge" :class="statusClass">{{ statusLabel }}</span>
        <a
          v-if="project.github_url"
          class="github-link"
          :href="project.github_url"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open GitHub repository"
          title="GitHub Repo"
        >
          <svg class="github-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m12.301 0h.093c2.242 0 4.34.613 6.137 1.68l-.055-.031c1.871 1.094 3.386 2.609 4.449 4.422l.031.058c1.04 1.769 1.654 3.896 1.654 6.166 0 5.406-3.483 10-8.327 11.658l-.087.026c-.063.02-.135.031-.209.031-.162 0-.312-.054-.433-.144l.002.001c-.128-.115-.208-.281-.208-.466 0-.005 0-.01 0-.014v.001q0-.048.008-1.226t.008-2.154c.007-.075.011-.161.011-.249 0-.792-.323-1.508-.844-2.025.618-.061 1.176-.163 1.718-.305l-.076.017c.573-.16 1.073-.373 1.537-.642l-.031.017c.508-.28.938-.636 1.292-1.058l.006-.007c.372-.476.663-1.036.84-1.645l.009-.035c.209-.683.329-1.468.329-2.281 0-.045 0-.091-.001-.136v.007c0-.022.001-.047.001-.072 0-1.248-.482-2.383-1.269-3.23l.003.003c.168-.44.265-.948.265-1.479 0-.649-.145-1.263-.404-1.814l.011.026c-.115-.022-.246-.035-.381-.035-.334 0-.649.078-.929.216l.012-.005c-.568.21-1.054.448-1.512.726l.038-.022-.609.384c-.922-.264-1.981-.416-3.075-.416s-2.153.152-3.157.436l.081-.02q-.256-.176-.681-.433c-.373-.214-.814-.421-1.272-.595l-.066-.022c-.293-.154-.64-.244-1.009-.244-.124 0-.246.01-.364.03l.013-.002c-.248.524-.393 1.139-.393 1.788 0 .531.097 1.04.275 1.509l-.01-.029c-.785.844-1.266 1.979-1.266 3.227 0 .025 0 .051.001.076v-.004c-.001.039-.001.084-.001.13 0 .809.12 1.591.344 2.327l-.015-.057c.189.643.476 1.202.85 1.693l-.009-.013c.354.435.782.793 1.267 1.062l.022.011c.432.252.933.465 1.46.614l.046.011c.466.125 1.024.227 1.595.284l.046.004c-.431.428-.718 1-.784 1.638l-.001.012c-.207.101-.448.183-.699.236l-.021.004c-.256.051-.549.08-.85.08-.022 0-.044 0-.066 0h.003c-.394-.008-.756-.136-1.055-.348l.006.004c-.371-.259-.671-.595-.881-.986l-.007-.015c-.198-.336-.459-.614-.768-.827l-.009-.006c-.225-.169-.49-.301-.776-.38l-.016-.004-.32-.048c-.023-.002-.05-.003-.077-.003-.14 0-.273.028-.394.077l.007-.003q-.128.072-.08.184c.039.086.087.16.145.225l-.001-.001c.061.072.13.135.205.19l.003.002.112.08c.283.148.516.354.693.603l.004.006c.191.237.359.505.494.792l.01.024.16.368c.135.402.38.738.7.981l.005.004c.3.234.662.402 1.057.478l.016.002c.33.064.714.104 1.106.112h.007c.045.002.097.002.15.002.261 0 .517-.021.767-.062l-.027.004.368-.064q0 .609.008 1.418t.008.873v.014c0 .185-.08.351-.208.466h-.001c-.119.089-.268.143-.431.143-.075 0-.147-.011-.214-.032l.005.001c-4.929-1.689-8.409-6.283-8.409-11.69 0-2.268.612-4.393 1.681-6.219l-.032.058c1.094-1.871 2.609-3.386 4.422-4.449l.058-.031c1.739-1.034 3.835-1.645 6.073-1.645h.098-.005zm-7.64 17.666q.048-.112-.112-.192-.16-.048-.208.032-.048.112.112.192.144.096.208-.032zm.497.545q.112-.08-.032-.256-.16-.144-.256-.048-.112.08.032.256.159.157.256.047zm.48.72q.144-.112 0-.304-.128-.208-.272-.096-.144.08 0 .288t.272.112zm.672.673q.128-.128-.064-.304-.192-.192-.32-.048-.144.128.064.304.192.192.32.044zm.913.4q.048-.176-.208-.256-.24-.064-.304.112t.208.24q.24.097.304-.096zm1.009.08q0-.208-.272-.176-.256 0-.256.176 0 .208.272.176.256.001.256-.175zm.929-.16q-.032-.176-.288-.144-.256.048-.224.24t.288.128.225-.224z" />
          </svg>
        </a>
      </div>
    </div>

    <p class="description">{{ project.description }}</p>

    <div class="skill-tags" v-if="tags.length">
      <span v-for="skill in tags" :key="skill" class="skill-tag">{{ skill }}</span>
    </div>
    <div v-else class="meta">需要技能：未填</div>

    <div class="meta project-capacity">
      <span>{{ capacityText(project) }}</span>
      <span v-if="isFull">狀態：已額滿</span>
      <span>聯絡：{{ project.contact || '申請後確認' }}</span>
    </div>

    <div class="card-actions">
      <button
        class="ghost favorite-button compact"
        type="button"
        :aria-pressed="Boolean(project.is_favorited)"
        @click="$emit('favorite', project)"
      >
        {{ favoriteText(project) }}
      </button>
      <button
        v-if="user && !isOwner"
        class="ghost danger compact-action"
        type="button"
        @click="$emit('report', project)"
      >
        檢舉
      </button>
      <button class="compact-action" type="button" :disabled="!isLoginRequired && !canApply" @click="$emit('apply', project)">
        {{ applyButtonText }}
      </button>
    </div>



    <div v-if="isOwner" class="applications">
      <strong>待審核申請</strong>
      <div v-if="!project.applications.length" class="mini-item">目前沒有待審核申請</div>
      <div v-for="item in project.applications" :key="item.id" class="application-row">
        <span>
          <DisplayName :name="item.applicant_name" :role="item.applicant_role" />
          | {{ item.applicant_skills || '未填技能' }}
          | {{ item.message || '沒有申請訊息' }}
        </span>
        <button class="ghost" type="button" @click="$emit('update-application', project, item, 'accepted')">接受</button>
        <button class="ghost" type="button" @click="$emit('update-application', project, item, 'rejected')">拒絕</button>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import DisplayName from './DisplayName.vue'
import {
  canApplyToProject,
  capacityText,
  favoriteText,
  isProjectFull,
  skillTags
} from '../utils/projectPresentation'

const props = defineProps({
  project: {
    type: Object,
    required: true
  },
  user: {
    type: Object,
    default: null
  }
})

defineEmits(['apply', 'comment', 'favorite', 'report', 'update-application'])

const isOwner = computed(() => {
  const currentUserId = props.user?.student_id || props.user?.id
  return Boolean(currentUserId && currentUserId === props.project.owner_id)
})
const tags = computed(() => skillTags(props.project.required_skills))
const isFull = computed(() => isProjectFull(props.project))
const isLoginRequired = computed(() => !props.user)
const canApply = computed(() => canApplyToProject(props.project, props.user))
const statusLabel = computed(() => {
  if (isFull.value) return '已額滿'
  return props.project.accepting_applications ? '開放中' : '暫停申請'
})
const statusClass = computed(() => {
  if (isFull.value) return 'full'
  return props.project.accepting_applications ? 'open' : 'paused'
})
const applyButtonText = computed(() => {
  if (isLoginRequired.value) return '登入後申請'
  if (props.project.application_status === 'pending') return '已申請'
  if (props.project.application_status === 'accepted') return '已加入'
  if (!props.project.accepting_applications) return '暫停申請'
  if (isFull.value) return '已額滿'
  return '申請加入'
})
</script>
