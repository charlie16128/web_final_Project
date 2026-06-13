<template>
  <div class="account-modal-backdrop" @click.self="$emit('close')">
    <form class="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title" @submit.prevent="submit">
      <div class="modal-head">
        <div>
          <p class="eyebrow">Account</p>
          <h2 id="account-modal-title">帳號設定</h2>
        </div>
        <button class="ghost modal-close" type="button" aria-label="關閉帳號設定" @click="$emit('close')">x</button>
      </div>
      <label>學號
        <input :value="user?.student_id" disabled>
      </label>
      <label>姓名
        <input :value="user?.name" disabled>
      </label>
      <label>Email
        <input v-model.trim="form.email" type="email" required>
      </label>
      <label>新密碼
        <input v-model.trim="form.password" type="password" minlength="6" placeholder="不修改可留空">
      </label>
      <div class="form-actions">
        <button class="ghost" type="button" @click="$emit('close')">取消</button>
        <button type="submit">儲存</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue'

const props = defineProps({
  user: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'save'])

const form = reactive({
  email: '',
  password: ''
})

watch(
  () => props.user,
  (user) => {
    form.email = user?.email || ''
    form.password = ''
  },
  { immediate: true }
)

function submit() {
  emit('save', {
    email: form.email,
    password: form.password
  })
}
</script>
