<template>
  <div class="countdown-bar announcement-bar">
    <button
      v-if="canManage"
      class="add-countdown-btn"
      type="button"
      @click="$emit('add')"
    >
      + 新增公告
    </button>

    <div class="countdown-scroll">
      <button
        v-for="announcement in announcements"
        :key="announcement.id"
        class="countdown-card announcement-card"
        type="button"
        @click="$emit('open', announcement)"
      >
        <span class="countdown-title">{{ shortContent(announcement.content) }}</span>
        <small>{{ formatTime(announcement.updated_at || announcement.created_at) }}</small>
      </button>
      <span v-if="!announcements.length" class="countdown-empty">目前沒有公告</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  announcements: {
    type: Array,
    default: () => []
  },
  canManage: {
    type: Boolean,
    default: false
  }
})

defineEmits(['add', 'open'])

function shortContent(content) {
  if (!content) {
    return ''
  }
  return content.length > 8 ? content.slice(0, 8) + '...' : content
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
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}
</script>

<style scoped>
.announcement-bar {
  align-items: center;
  display: flex;
  gap: 10px;
  max-width: 100%;
  overflow: hidden;
  width: 100%;
}

.add-countdown-btn {
  background: linear-gradient(135deg, #047857, #f59e0b);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  flex: 0 0 auto;
  font-weight: 800;
  min-height: 42px;
  padding: 8px 14px;
}

.countdown-scroll {
  display: flex;
  flex: 1;
  gap: 10px;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
  white-space: nowrap;
}

.announcement-card {
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
  width: 160px;
}

.announcement-card:hover {
  border-color: rgba(4, 120, 87, 0.45);
  transform: translateY(-1px);
}

.countdown-title {
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.announcement-card small,
.countdown-empty {
  color: #475569;
  font-size: 15px;
  font-weight: 700;
}

.countdown-empty {
  align-items: center;
  background: #f1f5f9;
  border-radius: 8px;
  display: inline-flex;
  min-height: 42px;
  padding: 0 12px;
}
</style>
