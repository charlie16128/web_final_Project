<template>
  <nav class="main-navbar" aria-label="主要功能">
    <RouterLink :to="{ name: 'home' }">主畫面</RouterLink>
    <RouterLink :to="{ name: 'my-groups' }">我的群組</RouterLink>
    <RouterLink :to="{ name: 'applications-invitations' }">申請邀請</RouterLink>
  </nav>
</template>
