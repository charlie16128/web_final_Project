<template>
  <div class="floating-modal-backdrop" @click.self="$emit('close')">
    <section class="floating-modal countdown-modal">
      <div class="modal-head">
        <h2>{{ isCreateMode ? '新增倒數' : '倒數詳細內容' }}</h2>
        <button class="modal-close ghost" type="button" @click="$emit('close')">x</button>
      </div>

      <form v-if="isCreateMode || isEditing" class="stack" @submit.prevent="submit">
        <label data-required>
          完整標題
          <input v-model.trim="form.title">
        </label>
        <label>
          完整說明
          <textarea v-model.trim="form.description" rows="3"></textarea>
        </label>
        <label data-required>
          目標時間
          <input v-model="form.target_time" type="datetime-local">
        </label>
        <small v-if="error" class="modal-error">{{ error }}</small>
        <div class="form-actions">
          <button class="ghost" type="button" @click="cancelEdit">取消</button>
          <button type="submit">{{ isCreateMode ? '新增倒數' : '更新倒數' }}</button>
        </div>
      </form>

      <div v-else class="countdown-detail">
        <dl class="countdown-detail-grid">
          <div>
            <dt>完整標題</dt>
            <dd>{{ countdown.title }}</dd>
          </div>
          <div>
            <dt>完整說明</dt>
            <dd>{{ countdown.description || '未填' }}</dd>
          </div>
          <div>
            <dt>目標時間</dt>
            <dd>{{ formatTime(countdown.target_time) }}</dd>
          </div>
          <div>
            <dt>剩餘時間</dt>
            <dd>{{ remainingDetail }}</dd>
          </div>
          <div>
            <dt>建立者</dt>
            <dd>{{ countdown.creator_name || countdown.created_by }}</dd>
          </div>
        </dl>

        <div class="form-actions">
          <button v-if="canModify" class="ghost" type="button" @click="startEdit">編輯</button>
          <button v-if="canModify" class="ghost danger" type="button" @click="$emit('delete', countdown)">刪除</button>
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
  countdown: {
    type: Object,
    default: null
  },
  currentUserId: {
    type: String,
    default: ''
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
  title: '',
  description: '',
  target_time: ''
})

const isCreateMode = computed(() => props.mode === 'create')
const canModify = computed(() => (
  Boolean(props.countdown) &&
  (props.canManage || props.countdown.created_by === props.currentUserId)
))

const remainingDetail = computed(() => {
  if (!props.countdown?.target_time) {
    return ''
  }

  const diff = new Date(props.countdown.target_time).getTime() - Date.now()
  if (!Number.isFinite(diff) || diff <= 0) {
    return '已到期'
  }

  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  return `${days} 天 ${hours} 小時 ${minutes} 分 ${seconds} 秒`
})

function toLocalInputValue(value) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offsetDate.toISOString().slice(0, 16)
}

function resetForm() {
  form.title = props.countdown?.title || ''
  form.description = props.countdown?.description || ''
  form.target_time = toLocalInputValue(props.countdown?.target_time)
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
  if (!form.title || !form.target_time) {
    error.value = '*請輸入標題與目標時間'
    return
  }

  const payload = {
    title: form.title,
    description: form.description,
    target_time: form.target_time
  }

  if (isCreateMode.value) {
    emit('create', payload)
    return
  }

  emit('update', props.countdown, payload)
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
  () => [props.countdown, props.mode],
  resetForm,
  { immediate: true }
)
</script>

<style scoped>
.countdown-modal {
  max-width: 560px;
}

.countdown-detail {
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
  font-size: 12px;
  font-weight: 800;
  margin-bottom: 4px;
}

.countdown-detail-grid dd {
  color: #0f172a;
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
