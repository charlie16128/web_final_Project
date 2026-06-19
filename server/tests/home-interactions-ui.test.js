var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

function readClient(filePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', 'client', filePath), 'utf8');
}

test('project applications open a floating message modal instead of inline card input', function() {
  var projectCard = readClient('src/components/ProjectCard.vue');
  var homeView = readClient('src/views/HomeView.vue');
  var projects = readClient('src/composables/useProjects.js');

  assert.doesNotMatch(projectCard, /v-model\.trim="project\.applyMessage"/);
  assert.doesNotMatch(projectCard, /<input[\s\S]*申請訊息/);
  assert.match(projectCard, /@click="\$emit\('apply', project\)"/);
  assert.match(homeView, /@apply="openApplyModal"/);
  assert.match(homeView, /applyProjectTarget/);
  assert.match(homeView, /submitApplyModal/);
  assert.match(homeView, /title="申請加入"/);
  assert.match(projects, /async function applyProject\(project, message = ''\)/);
});

test('home project list reveals projects in batches of five while scrolling', function() {
  var homeView = readClient('src/views/HomeView.vue');

  assert.match(homeView, /PROJECT_BATCH_SIZE = 5/);
  assert.match(homeView, /visibleProjectCount/);
  assert.match(homeView, /displayedProjects/);
  assert.match(homeView, /v-for="project in displayedProjects"/);
  assert.match(homeView, /IntersectionObserver/);
  assert.match(homeView, /loadMoreProjects/);
  assert.match(homeView, /projectListSentinel/);
});

test('main navigation labels include emoji prefixes', function() {
  var mainNavbar = readClient('src/components/MainNavbar.vue');

  assert.match(mainNavbar, /🏠/);
  assert.match(mainNavbar, /👥/);
  assert.match(mainNavbar, /📨/);
});

test('project creation form uses a slide-down transition and is not shown immediately', function() {
  var projectForm = readClient('src/components/ProjectForm.vue');
  var style = readClient('src/assets/style.css');

  assert.match(projectForm, /const open = ref\(props\.defaultOpen\)/);
  assert.match(projectForm, /<Transition name="project-form-slide"/);
  assert.match(projectForm, /v-show="open"/);
  assert.match(style, /\.project-form-slide-enter-active/);
  assert.match(style, /max-height/);
});

test('global border radius is fixed at sixteen pixels', function() {
  var style = readClient('src/assets/style.css');

  assert.match(style, /--radius:\s*16px/);
  assert.match(style, /border-radius:\s*var\(--radius\)\s*!important/);
});

test('anonymous visitors can view home while protected pages still require login', function() {
  var router = readClient('src/router/index.js');
  var homeRoute = router.slice(
    router.indexOf("name: 'home'"),
    router.indexOf("name: 'my-groups'")
  );

  assert.match(router, /name:\s*'home'[\s\S]*component:\s*HomeView/);
  assert.doesNotMatch(homeRoute, /requiresAuth:\s*true/);
  assert.match(router, /name:\s*'my-groups'[\s\S]*meta:\s*\{\s*requiresAuth:\s*true\s*\}/);
  assert.match(router, /name:\s*'applications-invitations'[\s\S]*meta:\s*\{\s*requiresAuth:\s*true\s*\}/);
  assert.match(router, /name:\s*'group'[\s\S]*meta:\s*\{\s*requiresAuth:\s*true\s*\}/);
  assert.match(router, /if \(to\.meta\.requiresAuth && !token\)/);
  assert.match(router, /return \{ name:\s*'login' \}/);
});

test('home loads public projects without forcing anonymous visitors through users me', function() {
  var homeView = readClient('src/views/HomeView.vue');

  assert.match(homeView, /localStorage\.getItem\('teamup_token'\)/);
  assert.match(homeView, /if \(localStorage\.getItem\('teamup_token'\)\) \{\s*await loadUser\(\)\s*\}/);
  assert.match(homeView, /await loadProjects\(\)/);
});

test('project card and project actions send anonymous visitors to login', function() {
  var projectCard = readClient('src/components/ProjectCard.vue');
  var homeView = readClient('src/views/HomeView.vue');
  var projects = readClient('src/composables/useProjects.js');

  assert.match(projectCard, /isLoginRequired/);
  assert.match(projectCard, /:disabled="!isLoginRequired && !canApply"/);
  assert.match(projectCard, /if \(isLoginRequired\.value\) return '登入後申請'/);
  assert.match(homeView, /function requireLogin\(\)/);
  assert.match(homeView, /router\.push\(\{ name:\s*'login' \}\)/);
  assert.match(projects, /onLoginRequired/);
  assert.match(projects, /if \(!user\?\.value\) \{\s*await onLoginRequired\?\.\(\)/);
});

test('anonymous home header and project creation controls point visitors to login', function() {
  var appHeader = readClient('src/components/AppHeader.vue');
  var homeView = readClient('src/views/HomeView.vue');
  var projectForm = readClient('src/components/ProjectForm.vue');

  assert.doesNotMatch(appHeader, />尚未登入</);
  assert.match(appHeader, /RouterLink v-else class="appheaderbutton"/);
  assert.match(appHeader, /:to="\{ name: 'login' \}"/);
  assert.match(appHeader, />前往登入</);
  assert.match(appHeader, /border-radius:\s*var\(--radius\)/);
  assert.match(homeView, /<ProjectForm\s+:disabled="!user"\s+disabled-text="登入已建立"/);
  assert.match(projectForm, /disabledText/);
  assert.match(projectForm, /:disabled="disabled"/);
  assert.match(projectForm, /\{\{ disabled \? disabledText : \(open \? '收合表單' : '建立專題'\) \}\}/);
});
