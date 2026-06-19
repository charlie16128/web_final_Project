<template>
  <div class="floating-modal-backdrop" @click.self="$emit('close')">
    <section class="floating-modal announcement-modal">
      <div class="modal-head">
        <h2>{{ isCreateMode ? '新增公告' : '公告詳細內容' }}</h2>
        <button class="modal-close ghost" type="button" @click="$emit('close')">x</button>
      </div>

      <form v-if="isCreateMode || isEditing" class="stack" @submit.prevent="submit">
        <label data-required>
          公告內容
          <textarea v-model.trim="form.content" rows="5" placeholder="輸入公告內容"></textarea>
        </label>
        <small v-if="error" class="modal-error">{{ error }}</small>
        <div class="form-actions">
          <button class="ghost" type="button" @click="cancelEdit">取消</button>
          <button type="submit">{{ isCreateMode ? '新增公告' : '更新公告' }}</button>
        </div>
      </form>

      <div v-else class="announcement-detail">
        <dl class="countdown-detail-grid">
          <div>
            <dt>公告內容</dt>
            <dd>{{ announcement.content }}</dd>
          </div>
          <div>
            <dt>發布者</dt>
            <dd>{{ announcement.author_name || announcement.author_id }}</dd>
          </div>
          <div>
            <dt>發布時間</dt>
            <dd>{{ formatTime(announcement.created_at) }}</dd>
          </div>
          <div v-if="announcement.updated_at">
            <dt>更新時間</dt>
            <dd>{{ formatTime(announcement.updated_at) }}</dd>
          </div>
        </dl>

        <div class="form-actions">
          <button v-if="canManage" class="ghost" type="button" @click="startEdit">編輯</button>
          <button v-if="canManage" class="ghost danger" type="button" @click="$emit('delete', announcement)">刪除</button>
          <button type="button" @click="$emit('close')">關閉</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'

const props = defineProps({
  mode: {
    type: String,
    default: 'view'
  },
  announcement: {
    type: Object,
    default: null
  },
  canManage: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'create', 'update', 'delete'])
const isEditing = ref(false)
const error = ref('')
const form = reactive({
  content: ''
})

const isCreateMode = computed(() => props.mode === 'create')

function resetForm() {
  form.content = props.announcement?.content || ''
  error.value = ''
  isEditing.value = false
}

function startEdit() {
  resetForm()
  isEditing.value = true
}

function cancelEdit() {
  if (isCreateMode.value) {
    emit('close')
    return
  }
  resetForm()
}

function submit() {
  if (!form.content) {
    error.value = '*請輸入公告內容'
    return
  }

  const payload = {
    content: form.content
  }

  if (isCreateMode.value) {
    emit('create', payload)
    return
  }

  emit('update', props.announcement, payload)
}

function formatTime(value) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
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

watch(
  () => [props.announcement, props.mode],
  resetForm,
  { immediate: true }
)
</script>

<style scoped>
.announcement-modal {
  max-width: 560px;
}

.announcement-detail {
  display: grid;
  gap: 18px;
}

.countdown-detail-grid {
  display: grid;
  gap: 12px;
  margin: 0;
}

.countdown-detail-grid div {
  border: 1px solid #dbe4f0;
  border-radius: 8px;
  padding: 10px 12px;
}

.countdown-detail-grid dt {
  color: #475569;
  font-size: 15px;
  font-weight: 800;
  margin-bottom: 4px;
}

.countdown-detail-grid dd {
  color: #0f172a;
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
