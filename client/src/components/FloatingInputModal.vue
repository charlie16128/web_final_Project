<template>
  <div class="floating-modal-backdrop" @click.self="$emit('close')">
    <form class="floating-modal input-modal" @submit.prevent="submit">
      <div class="modal-head">
        <h2>{{ title }}</h2>
        <button class="modal-close ghost" type="button" @click="$emit('close')">x</button>
      </div>

      <label>
        {{ label }}
        <textarea v-model.trim="message" rows="4" :placeholder="placeholder"></textarea>
      </label>
      <small v-if="error" class="modal-error">{{ error }}</small>

      <div v-if="showBanDays" class="ban-duration-grid">
        <label>
          天
          <input v-model.number="banDuration.days" type="number" min="0" max="365" placeholder="0">
        </label>
        <label>
          小時
          <input v-model.number="banDuration.hours" type="number" min="0" max="23" placeholder="0">
        </label>
        <label>
          分鐘
          <input v-model.number="banDuration.minutes" type="number" min="0" max="59" placeholder="0">
        </label>
        <label>
          秒
          <input v-model.number="banDuration.seconds" type="number" min="0" max="59" placeholder="0">
        </label>
        <small class="modal-hint">至少輸入一個大於 0 的時間欄位。</small>
      </div>

      <div class="form-actions">
        <button class="ghost" type="button" @click="$emit('close')">取消</button>
        <button type="submit">{{ submitText }}</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  placeholder: {
    type: String,
    default: ''
  },
  submitText: {
    type: String,
    default: '送出'
  },
  required: {
    type: Boolean,
    default: true
  },
  showBanDays: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'submit'])
const message = ref('')
const banDuration = ref({
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0
})
const error = ref('')

watch(
  () => props.title,
  () => {
    message.value = ''
    banDuration.value = {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0
    }
    error.value = ''
  }
)

function submit() {
  if (props.required && !message.value.trim()) {
    error.value = '*請輸入內容'
    return
  }

  emit('submit', {
    message: message.value.trim(),
    days: Number(banDuration.value.days || 0),
    hours: Number(banDuration.value.hours || 0),
    minutes: Number(banDuration.value.minutes || 0),
    seconds: Number(banDuration.value.seconds || 0)
  })
}
</script>
