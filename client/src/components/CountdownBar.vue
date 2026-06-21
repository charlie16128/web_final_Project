<template>
  <div class="countdown-bar">
    <button class="add-countdown-btn" type="button" @click="$emit('add')">
      + 新增倒數
    </button>

    <div class="countdown-scroll">
      <CountdownCard
        v-for="countdown in countdowns"
        :key="countdown.id"
        :countdown="countdown"
        @open="$emit('open', countdown)"
      />
      <span v-if="!countdowns.length" class="countdown-empty">目前沒有倒數</span>
    </div>
  </div>
</template>

<script setup>
import CountdownCard from './CountdownCard.vue'

defineProps({
  countdowns: {
    type: Array,
    default: () => []
  }
})

defineEmits(['add', 'open'])
</script>

<style scoped>
.countdown-bar {
  align-items: center;
  display: flex;
  gap: 10px;
  max-width: 100%;
  overflow: hidden;
  width: 100%;
}

.add-countdown-btn {
  background: var(--button);
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

.countdown-empty {
  align-items: center;
  background: #f1f5f9;
  border-radius: 8px;
  color: #475569;
  display: inline-flex;
  font-size: 16px;
  font-weight: 700;
  min-height: 42px;
  padding: 0 12px;
}
</style>
