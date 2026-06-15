<template>
  <span class="display-name">
    <span v-if="admin" class="admin-prefix">[ADMIN]</span>{{ displayName }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { baseDisplayName, isAdminUser } from '../utils/displayName'

const props = defineProps({
  user: {
    type: Object,
    default: null
  },
  name: {
    type: String,
    default: ''
  },
  username: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    default: ''
  }
})

const displayUser = computed(() => props.user || {
  name: props.name,
  username: props.username,
  role: props.role
})

const admin = computed(() => isAdminUser(displayUser.value))
const displayName = computed(() => baseDisplayName(displayUser.value))
</script>
