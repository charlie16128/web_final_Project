<template>
  <div :class="['app-frame', { 'app-frame--auth': isAuthRoute, 'app-frame--group': isGroupRoute }]">
    <RouterView />
    <SystemWarningModal
      v-if="warnings.length"
      :warnings="warnings"
      @dismiss="dismissWarning"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from './services/api'
import SystemWarningModal from './components/SystemWarningModal.vue'

const route = useRoute()
const warnings = ref([])
const isAuthRoute = computed(() => route.name === 'login' || route.name === 'register')
const isGroupRoute = computed(() => route.name === 'group')

async function loadWarnings() {
  if (!localStorage.getItem('teamup_token')) {
    warnings.value = []
    return
  }

  try {
    const response = await api.get('/me/warnings')
    warnings.value = response.data.warnings || []
  } catch (error) {
    warnings.value = []
  }
}

async function dismissWarning(warning) {
  await api.delete(`/me/warnings/${warning.id}`)
  warnings.value = warnings.value.filter((item) => item.id !== warning.id)
}

onMounted(loadWarnings)
watch(() => route.fullPath, loadWarnings)
</script>
