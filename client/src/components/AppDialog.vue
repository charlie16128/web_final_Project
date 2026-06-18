<template>
  <div class="floating-modal-backdrop" @click.self="close">
    <section class="floating-modal dialog-modal">
      <div class="modal-head">
        <h2>{{ title }}</h2>
        <button class="modal-close ghost" type="button" @click="close">x</button>
      </div>

      <p class="dialog-message">{{ message }}</p>

      <div class="form-actions">
        <button
          v-if="showCancel"
          class="ghost"
          type="button"
          @click="$emit('cancel')"
        >
          {{ cancelText }}
        </button>
        <button
          :class="confirmButtonClass"
          type="button"
          @click="$emit('confirm')"
        >
          {{ confirmText }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: '訊息'
  },
  message: {
    type: String,
    required: true
  },
  confirmText: {
    type: String,
    default: '確定'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  showCancel: {
    type: Boolean,
    default: false
  },
  danger: {
    type: Boolean,
    default: false
  },
  confirmClass: {
    type: [String, Array, Object],
    default: ''
  }
})

const emit = defineEmits(['confirm', 'cancel'])

const confirmButtonClass = computed(() => (
  props.confirmClass || { danger: props.danger }
))

function close() {
  if (props.showCancel) {
    emit('cancel')
    return
  }
  emit('confirm')
}
</script>

<style scoped>
.dialog-modal {
  max-width: 460px;
}

.dialog-message {
  color: var(--ink);
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
