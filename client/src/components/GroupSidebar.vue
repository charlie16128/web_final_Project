<template>
  <aside class="sidebar">
    <section class="panel group-panel">
      <div class="section-title">
        <h2>我的群組</h2>
        <p>快速進入你建立或已加入的專題群組。</p>
      </div>

      <div class="segmented group-tabs" :class="tabClass">
        <button type="button" :class="{ active: modelValue === 'all' }" @click="changeTab('all')">
          全部 {{ counts.all }}
        </button>
        <button type="button" :class="{ active: modelValue === 'joined' }" @click="changeTab('joined')">
          已加入 {{ counts.joined }}
        </button>
        <button type="button" :class="{ active: modelValue === 'owned' }" @click="changeTab('owned')">
          我建立 {{ counts.owned }}
        </button>
      </div>

      <TransitionGroup :key="modelValue" name="group-list" tag="div" class="group-list">
        <div v-if="!visibleGroups.length" key="empty" class="mini-item">目前沒有群組</div>
        <RouterLink
          v-for="group in visibleGroups"
          :key="group.id"
          class="group-item"
          :to="{ name: 'group', params: { id: group.id } }"
        >
          <div>
            <strong>{{ group.title }}</strong>
            <span>{{ group.relation === 'owned' ? '我建立' : '已加入' }}</span>
          </div>
          <small>{{ groupStatusText(group) }} | {{ group.current_members }} / {{ group.max_members }}</small>
        </RouterLink>
      </TransitionGroup>
    </section>

    <section class="panel applications-panel">
      <div class="section-title">
        <h2>我的申請</h2>
        <p>追蹤送出的加入申請狀態。</p>
      </div>
      <div class="mini-list">
        <div v-if="!pendingApplications.length" class="mini-item">尚未送出申請</div>
        <RouterLink
          v-for="item in pendingApplications"
          :key="item.id"
          class="mini-item application-link"
          :to="{ name: 'group', params: { id: item.project_id } }"
        >
          <b>{{ item.project_title }}</b><br>
          {{ statusText(item.status) }}
        </RouterLink>
      </div>
    </section>

  </aside>
</template>

<script setup>
import { computed, ref } from 'vue'
import { statusText } from '../utils/status'
import { isProjectFull } from '../utils/projectPresentation'

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

const emit = defineEmits(['update:modelValue'])
const switching = ref(false)
let switchingTimer = 0

const ownedGroups = computed(() => (
  (props.groups.owned || []).map((group) => ({
    ...group,
    relation: 'owned'
  }))
))

const joinedGroups = computed(() => {
  const ownedIds = new Set(ownedGroups.value.map((group) => group.id))

  return (props.groups.joined || [])
    .filter((group) => !ownedIds.has(group.id))
    .map((group) => ({
      ...group,
      relation: 'joined'
    }))
})

const allGroups = computed(() => [
  ...ownedGroups.value,
  ...joinedGroups.value
])
  
const counts = computed(() => ({
  owned: ownedGroups.value.length,
  joined: joinedGroups.value.length,
  all: allGroups.value.length
}))

const visibleGroups = computed(() => {
  if (props.modelValue === 'owned') {
    return ownedGroups.value
  }
  if (props.modelValue === 'joined') {
    return joinedGroups.value
  }
  return allGroups.value
})

const pendingApplications = computed(() => props.applications.filter((item) => item.status === 'pending'))

const tabClass = computed(() => ({
  [`tab-${props.modelValue}`]: true,
  'is-switching': switching.value
}))

function changeTab(tab) {
  if (tab === props.modelValue) {
    return
  }

  switching.value = true
  window.clearTimeout(switchingTimer)
  emit('update:modelValue', tab)
  switchingTimer = window.setTimeout(() => {
    switching.value = false
  }, 220)
}

function groupStatusText(group) {
  if (isProjectFull(group)) {
    return '已額滿'
  }
  return group.accepting_applications ? '開放中' : '暫停申請'
}
</script>
