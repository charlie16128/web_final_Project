<template>
  <article class="project-card">
    <div class="project-head">
      <div>
        <h3>{{ project.title }}</h3>
        <div class="meta">
          {{ project.course_name || '未填課程' }} |
          {{ project.teacher_name || '未填教師' }} |
          建立者 {{ project.owner_name }}
        </div>
      </div>
      <div class="badge-stack">
        <span class="badge" :class="project.status">{{ statusText(project.status) }}</span>
        <span v-if="!project.accepting_applications" class="badge paused">暫停申請</span>
      </div>
    </div>

    <p class="description">{{ project.description }}</p>
    <div class="meta">需要技能：{{ project.required_skills || '未填' }}</div>
    <div class="meta">人數：{{ project.current_members }} / {{ project.max_members }} | 聯絡：{{ project.contact || '申請後確認' }}</div>

    <form class="card-actions" @submit.prevent="$emit('apply', project)">
      <input v-model.trim="project.applyMessage" :disabled="!canApply" placeholder="申請訊息，例如你的技能或可配合時間">
      <button type="submit" :disabled="!canApply">
        {{ project.accepting_applications ? '申請加入' : '暫停申請' }}
      </button>
    </form>

    <form class="comment-form" @submit.prevent="$emit('comment', project)">
      <input v-model.trim="project.commentContent" placeholder="留言詢問專題細節">
      <button class="ghost" type="submit">留言</button>
    </form>

    <div class="comments">
      <strong>留言</strong>
      <div v-if="!project.comments.length" class="comment">尚無留言</div>
      <div v-for="comment in project.comments" :key="comment.id" class="comment">
        <b>{{ comment.user_name }}</b>：{{ comment.content }}
      </div>
    </div>

    <div v-if="isOwner" class="applications">
      <strong>待審核申請</strong>
      <div v-if="!project.applications.length" class="mini-item">目前沒有待審核申請</div>
      <div v-for="item in project.applications" :key="item.id" class="application-row">
        <span>{{ item.applicant_name }} | {{ item.applicant_skills || '未填技能' }} | {{ item.message || '沒有申請訊息' }}</span>
        <button class="ghost" type="button" @click="$emit('update-application', project, item, 'accepted')">接受</button>
        <button class="ghost" type="button" @click="$emit('update-application', project, item, 'rejected')">拒絕</button>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { statusText } from '../utils/status'

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

defineEmits(['apply', 'comment', 'update-application'])

const isOwner = computed(() => props.user && props.user.id === props.project.owner_id)
const canApply = computed(() => (
  props.project.accepting_applications &&
  props.project.status === 'open' &&
  props.user &&
  props.user.id !== props.project.owner_id
))
</script>
