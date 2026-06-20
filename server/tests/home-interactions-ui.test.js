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

test('project github repo links are editable and open from project cards and group details', function() {
  var projectForm = readClient('src/components/ProjectForm.vue');
  var projectCard = readClient('src/components/ProjectCard.vue');
  var groupView = readClient('src/views/GroupView.vue');
  var style = readClient('src/assets/style.css');

  assert.match(projectForm, /v-model\.trim="form\.github_url"/);
  assert.match(projectForm, /placeholder="https:\/\/github\.com\//);
  assert.match(projectForm, /github_url:\s*''/);

  assert.match(projectCard, /project\.github_url/);
  assert.match(projectCard, /class="github-link"/);
  assert.match(projectCard, /target="_blank"/);
  assert.match(projectCard, /rel="noopener noreferrer"/);
  assert.match(projectCard, /d="m12\.301 0h\.093/);

  assert.match(groupView, /v-if="group\.github_url"/);
  assert.match(groupView, /:href="group\.github_url"/);
  assert.match(groupView, /v-model\.trim="editForm\.github_url"/);
  assert.match(groupView, /github_url:\s*editForm\.github_url/);

  assert.match(style, /\.github-link/);
  assert.match(style, /\.github-icon/);
  assert.doesNotMatch(style, /padding:\s*18px 72px 18px 18px/);
  assert.doesNotMatch(style, /\.project-card \.github-link\s*\{[\s\S]*?position:\s*absolute/);
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

test('home first phase adds hero stats and a polished empty state', function() {
  var homeView = readClient('src/views/HomeView.vue');

  assert.match(homeView, /class="home-hero"/);
  assert.match(homeView, /TeamUp Campus/);
  assert.match(homeView, /:open-signal="openCreateFormSignal"/);
  assert.match(homeView, /const openProjectCount = computed/);
  assert.match(homeView, /current_members < project\.max_members/);
  assert.match(homeView, /const fullProjectCount = computed/);
  assert.match(homeView, /current_members >= project\.max_members/);
  assert.match(homeView, /const topSkill = computed/);
  assert.match(homeView, /class="home-stats"/);
  assert.match(homeView, /開放招募/);
  assert.match(homeView, /已額滿隊伍/);
  assert.match(homeView, /熱門技能/);
  assert.match(homeView, /class="empty-state"/);
  assert.match(homeView, /目前沒有符合條件的隊伍/);
  assert.match(homeView, /@click="openCreateProjectForm"/);
});

test('home popular skill stat explains the top skill with ranked counts', function() {
  var homeView = readClient('src/views/HomeView.vue');
  var style = readClient('src/assets/style.css');

  assert.match(homeView, /const popularSkills = computed/);
  assert.match(homeView, /Object\.entries\(countMap\)/);
  assert.match(homeView, /\.sort\(\(a, b\) => b\.count - a\.count/);
  assert.match(homeView, /\.slice\(0, 3\)/);
  assert.match(homeView, /const topSkill = computed\(\(\) => popularSkills\.value\[0\]\?\.name/);
  assert.match(homeView, /v-if="popularSkills\.length"/);
  assert.match(homeView, /v-for="skill in popularSkills"/);
  assert.match(homeView, /\{\{ skill\.name \}\}/);
  assert.match(homeView, /\{\{ skill\.count \}\} 次/);
  assert.match(homeView, /等待資料/);
  assert.match(style, /\.popular-skill-list/);
  assert.match(style, /\.popular-skill-pill/);
});

test('project creation form can be opened from the home hero call to action', function() {
  var projectForm = readClient('src/components/ProjectForm.vue');

  assert.match(projectForm, /openSignal/);
  assert.match(projectForm, /watch\(\(\) => props\.openSignal/);
  assert.match(projectForm, /open\.value = true/);
});

test('phase one campus glass visual tokens and controls are defined globally', function() {
  var style = readClient('src/assets/style.css');

  assert.match(style, /--panel:\s*rgba\(255,\s*255,\s*255,\s*0\.86\)/);
  assert.match(style, /--primary:\s*#047857/);
  assert.match(style, /--radius-sm:\s*10px/);
  assert.match(style, /--radius-lg:\s*24px/);
  assert.match(style, /radial-gradient\(circle at top left, rgba\(16, 185, 129, 0\.12\)/);
  assert.match(style, /\.panel,\s*\n\.project-card,\s*\n\.account-modal,\s*\n\.auth-card/);
  assert.match(style, /backdrop-filter:\s*blur\(14px\)/);
  assert.match(style, /button:hover\s*\{[\s\S]*transform:\s*translateY\(-1px\)/);
  assert.doesNotMatch(style, /button:hover\s*\{[\s\S]*transform:\s*scale\(1\.05\)/);
  assert.match(style, /\.home-hero/);
  assert.match(style, /\.home-stats/);
  assert.match(style, /\.empty-state/);
});

test('home hero keeps the content but removes colored background treatment', function() {
  var homeView = readClient('src/views/HomeView.vue');
  var style = readClient('src/assets/style.css');
  var heroTemplate = homeView.slice(
    homeView.indexOf('<section class="home-hero">'),
    homeView.indexOf('</section>', homeView.indexOf('<section class="home-hero">'))
  );
  var heroBlock = style.slice(
    style.indexOf('.home-hero {'),
    style.indexOf('.home-hero .eyebrow')
  );

  assert.match(heroBlock, /background:\s*var\(--panel\)/);
  assert.match(heroBlock, /border:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.72\)/);
  assert.match(heroBlock, /box-shadow:\s*var\(--shadow-sm\)/);
  assert.match(heroBlock, /color:\s*var\(--ink\)/);
  assert.doesNotMatch(heroBlock, /background:\s*linear-gradient/);
  assert.doesNotMatch(heroBlock, /color:\s*white/);
  assert.doesNotMatch(heroTemplate, /<button[\s\S]*openCreateProjectForm/);
});

test('campus glass palette avoids blue purple gradients', function() {
  var style = readClient('src/assets/style.css');
  var countdownBar = readClient('src/components/CountdownBar.vue');
  var announcementBar = readClient('src/components/AnnouncementBar.vue');
  var combined = [style, countdownBar, announcementBar].join('\n');
  var heroBlock = style.slice(
    style.indexOf('.home-hero {'),
    style.indexOf('.home-hero .eyebrow')
  );
  var bluePurpleGradientTokens = /(?:linear|radial)-gradient\([^;]*(?:#4f46e5|#3730a3|#0ea5e9|#7c3aed|#2563eb|rgba\(79,\s*70,\s*229|rgba\(14,\s*165,\s*233|rgba\(124,\s*58,\s*237|rgba\(37,\s*99,\s*235)/;

  assert.doesNotMatch(combined, bluePurpleGradientTokens);
  assert.doesNotMatch(heroBlock, /background:\s*linear-gradient/);
  assert.match(countdownBar, /linear-gradient\(135deg,\s*#047857,\s*#f59e0b\)/);
  assert.match(announcementBar, /linear-gradient\(135deg,\s*#047857,\s*#f59e0b\)/);
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
