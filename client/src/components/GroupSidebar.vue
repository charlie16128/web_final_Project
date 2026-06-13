<template>
  <aside class="sidebar">
    <section class="panel group-panel">
      <div class="section-title">
        <h2>我的群組</h2>
        <p>快速進入你建立或已加入的專題群組。</p>
      </div>

      <div class="segmented group-tabs" :class="tabClass">
        <button type="button" :class="{ active: modelValue === 'all' }" @click="$emit('update:modelValue', 'all')">
          全部 {{ counts.all }}
        </button>
        <button type="button" :class="{ active: modelValue === 'joined' }" @click="$emit('update:modelValue', 'joined')">
          已加入 {{ counts.joined }}
        </button>
        <button type="button" :class="{ active: modelValue === 'owned' }" @click="$emit('update:modelValue', 'owned')">
          我建立 {{ counts.owned }}
        </button>
      </div>

      <TransitionGroup :key="modelValue" name="group-list" tag="div" class="group-list">
        <div v-if="!visibleGroups.length" key="empty" class="mini-item">目前沒有群組</div>
        <RouterLink
          v-for="group in visibleGroups"
          :key="`${group.relation}-${group.id}`"
          class="group-item"
          :to="{ name: 'group', params: { id: group.id } }"
        >
          <div>
            <strong>{{ group.title }}</strong>
            <span>{{ group.relation === 'owned' ? '我建立' : '已加入' }}</span>
          </div>
          <small>{{ statusText(group.status) }} | {{ group.current_members }} / {{ group.max_members }}</small>
        </RouterLink>
      </TransitionGroup>
    </section>

    <section class="panel applications-panel">
      <div class="section-title">
        <h2>我的申請</h2>
        <p>追蹤送出的加入申請狀態。</p>
      </div>
      <div class="mini-list">
        <div v-if="!applications.length" class="mini-item">尚未送出申請</div>
        <div v-for="item in applications" :key="item.id" class="mini-item">
          <b>{{ item.project_title }}</b><br>
          {{ statusText(item.status) }}
        </div>
      </div>
    </section>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { statusText } from '../utils/status'

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  },
  groups: {
    type: Object,
    required: true
  },
  applications: {
    type: Array,
    default: () => []
  }
})

defineEmits(['update:modelValue'])

const counts = computed(() => ({
  owned: props.groups.owned.length,
  joined: props.groups.joined.length,
  all: props.groups.owned.length + props.groups.joined.length
}))

const visibleGroups = computed(() => {
  if (props.modelValue === 'owned') {
    return props.groups.owned
  }
  if (props.modelValue === 'joined') {
    return props.groups.joined
  }
  return props.groups.owned.concat(props.groups.joined)
})

const tabClass = computed(() => `tab-${props.modelValue}`)
</script>
