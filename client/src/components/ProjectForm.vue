<template>
  <section class="panel project-form-panel">
    <div class="project-toggle-head">
      <div class="section-title">
        <h2>建立專題</h2>
        <p>刊登新的課程專題，讓同學可以申請加入。</p>
      </div>
      <button type="button" @click="open = !open">
        {{ open ? '收合表單' : '建立專題' }}
      </button>
    </div>

    <form v-if="open" class="grid-form project-create-form" @submit.prevent="submit">
      <label data-required data-error="*請輸入專題名稱">專題名稱<input v-model.trim="form.title"></label>
      <label>課程名稱<input v-model.trim="form.course_name"></label>
      <label>授課教師<input v-model.trim="form.teacher_name"></label>
      <label>目前人數<input v-model.number="form.current_members" type="number" min="1"></label>
      <label data-required data-error="*請輸入人數上限">人數上限<input v-model.number="form.max_members" type="number" min="2"></label>
      <label>聯絡方式<input v-model.trim="form.contact" placeholder="Email / Line / Discord"></label>
      <label class="full">需要技能<input v-model.trim="form.required_skills"></label>
      <label class="checkbox-row full">
        <input v-model="form.accepting_applications" type="checkbox">
        <span>開放加入申請</span>
      </label>
      <label data-required class="full" data-error="*請輸入專題說明">專題說明<textarea v-model.trim="form.description" rows="4"></textarea></label>
      <button class="full" type="submit">送出專題</button>
    </form>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue'

const props = defineProps({
  defaultOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['create'])
const open = ref(props.defaultOpen)

const form = reactive(emptyProjectForm())

function emptyProjectForm() {
  return {
    title: '',
    course_name: '',
    teacher_name: '',
    current_members: 1,
    max_members: 4,
    contact: '',
    required_skills: '',
    accepting_applications: true,
    description: ''
  }
}

function submit() {
  emit('create', { ...form })
  Object.assign(form, emptyProjectForm())
  open.value = false
}
</script>
