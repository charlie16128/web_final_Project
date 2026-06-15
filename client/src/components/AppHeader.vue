<template>
  <header class="topbar">
    <div>
      <p class="eyebrow">TeamUp</p>
      <h1>
        <RouterLink class="brand-title" :to="{ name: 'home' }">
          校園專題組隊平台
        </RouterLink>
      </h1>
    </div>
    <div class="user-panel">
      <span v-if="user" :title="formatDisplayName(user)">您好 <DisplayName :user="user" /></span>
      <span v-else>尚未登入</span>
      <RouterLink v-if="backHome" class="button ghost" :to="{ name: 'home' }">回首頁</RouterLink>
      <button v-if="user && showAccount" class="appheaderbutton" type="button" @click="$emit('account')">帳號設定</button>
      <button v-if="user" class="appheaderbutton" type="button" @click="$emit('logout')">登出</button>
    </div>
  </header>
</template>

<script setup>
import DisplayName from './DisplayName.vue'
import { formatDisplayName } from '../utils/displayName'

defineProps({
  user: {
    type: Object,
    default: null
  },
  showAccount: {
    type: Boolean,
    default: false
  },
  backHome: {
    type: Boolean,
    default: false
  }
})

defineEmits(['account', 'logout'])
</script>

<style scoped>
.appheaderbutton {
  color: white;
  background-color: transparent;
  border: 1px solid var(--line);
}

.appheaderbutton:hover{
  background: rgb(82, 82, 82);
}
</style>
