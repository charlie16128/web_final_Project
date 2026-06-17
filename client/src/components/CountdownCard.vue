<template>
  <button class="countdown-card" type="button" @click="$emit('open', countdown)">
    <span class="countdown-title">{{ shortTitle(countdown.title) }}</span>
    <small>{{ remainingText }}</small>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  countdown: {
    type: Object,
    required: true
  }
})

defineEmits(['open'])

function shortTitle(title) {
  if (!title) {
    return ''
  }
  return title.length > 6 ? title.slice(0, 6) + '...' : title
}

const remainingText = computed(() => {
  if (!props.countdown.target_time) {
    return ''
  }

  const target = new Date(props.countdown.target_time)
  if (Number.isNaN(target.getTime())) {
    return props.countdown.target_time
  }

  const diff = target.getTime() - Date.now()
  if (diff <= 0) {
    return '已到期'
  }

  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) {
    return `${days}天 ${hours}小時`
  }
  const minutes = Math.floor((diff % 3600000) / 60000)
  return `${hours}小時 ${minutes}分`
})
</script>

<style scoped>
.countdown-card {
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(203, 213, 225, 0.9);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(30, 41, 59, 0.12);
  color: #0f172a;
  cursor: pointer;
  display: grid;
  flex: 0 0 auto;
  gap: 6px;
  min-height: 64px;
  padding: 10px 12px;
  text-align: left;
  width: 140px;
}

.countdown-card:hover {
  border-color: rgba(37, 99, 235, 0.45);
  transform: translateY(-1px);
}

.countdown-title {
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.countdown-card small {
  color: #475569;
  font-size: 12px;
  font-weight: 700;
}
</style>
