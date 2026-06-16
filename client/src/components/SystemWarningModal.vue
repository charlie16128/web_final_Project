<template>
  <div class="floating-modal-backdrop" role="presentation">
    <section class="floating-modal warning-modal" role="dialog" aria-modal="true" aria-labelledby="warning-modal-title">
      <div class="modal-head">
        <h2 id="warning-modal-title">系統警告</h2>
      </div>

      <article v-for="warning in warnings" :key="warning.id" class="modal-item">
        <p>{{ warning.message }}</p>
        <small>{{ warning.created_at }}</small>
        <button type="button" @click="$emit('dismiss', warning)">我已了解</button>
      </article>
    </section>
  </div>
</template>

<script setup>
defineProps({
  warnings: {
    type: Array,
    required: true
  }
})

defineEmits(['dismiss'])
</script>
