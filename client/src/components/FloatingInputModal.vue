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

      <label v-if="showBanDays">
        停權天數
        <input v-model.trim="banDays" type="number" min="1" max="365" placeholder="留空代表永久停權">
      </label>

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
const banDays = ref('')
const error = ref('')

watch(
  () => props.title,
  () => {
    message.value = ''
    banDays.value = ''
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
    ban_days: banDays.value ? Number(banDays.value) : null
  })
}
</script>
