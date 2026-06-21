<template>
  <nav class="main-navbar" aria-label="主導覽">
    <RouterLink :to="{ name: 'home' }">主頁</RouterLink>
    <RouterLink :to="{ name: 'my-groups' }">我的群組</RouterLink>
    <RouterLink :to="{ name: 'applications-invitations' }">申請邀請</RouterLink>
  </nav>
</template>
