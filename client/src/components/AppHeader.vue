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
      <RouterLink v-if="backHome" class="button ghost" :to="{ name: 'home' }">回首頁</RouterLink>
      <span v-else>{{ user ? `您好 ${user.name}` : '尚未登入' }}</span>
      <button v-if="user && showAccount" class="ghost" type="button" @click="$emit('account')">帳號設定</button>
      <button v-if="user" class="ghost" type="button" @click="$emit('logout')">登出</button>
    </div>
  </header>
</template>

<script setup>
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
