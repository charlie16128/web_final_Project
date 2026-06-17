<template>
  <div class="custom-select" ref="selectRef">
    <button
      class="select-trigger"
      type="button"
      :class="{ placeholder: !selectedLabel }"
      :disabled="disabled"
      @click="toggleOpen"
    >
      <span>{{ selectedLabel || placeholder }}</span>
      <span class="select-arrow" :class="{ open: isOpen }">⌄</span>
    </button>

    <div v-if="isOpen" class="select-menu">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="select-option"
        :class="{ active: option.value === modelValue }"
        @click="selectOption(option)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Number, Boolean],
    default: ''
  },
  options: {
    type: Array,
    default: () => []
  },
  placeholder: {
    type: String,
    default: '請選擇'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])
const isOpen = ref(false)
const selectRef = ref(null)

const selectedLabel = computed(() => (
  props.options.find((option) => option.value === props.modelValue)?.label || ''
))

function toggleOpen() {
  if (props.disabled) {
    return
  }
  isOpen.value = !isOpen.value
}

function selectOption(option) {
  emit('update:modelValue', option.value)
  isOpen.value = false
}

function handleClickOutside(event) {
  if (selectRef.value && !selectRef.value.contains(event.target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>
