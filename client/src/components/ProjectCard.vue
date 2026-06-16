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
    </div>

    <form class="card-actions" @submit.prevent="$emit('apply', project)">
      <input
        v-model.trim="project.applyMessage"
        :disabled="!canApply"
        placeholder="申請訊息，可簡述你的技能或動機"
      >
      <button type="submit" :disabled="!canApply">
        {{ applyButtonText }}
      </button>
    </form>



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
  if (!props.project.accepting_applications) return '暫停申請'
  if (isFull.value) return '已額滿'
  return '申請加入'
})
</script>
