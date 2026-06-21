var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var url = require('node:url');

function clientPath(filePath) {
  return path.join(__dirname, '..', '..', 'client', filePath);
}

function readClient(filePath) {
  return fs.readFileSync(clientPath(filePath), 'utf8');
}

test('project presentation utility formats skills, capacity, and project actions', async function() {
  var moduleUrl = url.pathToFileURL(clientPath('src/utils/projectPresentation.js')).href;
  var projectPresentation = await import(moduleUrl);

  var ideographicComma = String.fromCharCode(0x3001);
  var fullwidthComma = String.fromCharCode(0xFF0C);

  assert.deepEqual(projectPresentation.skillTags('Vue, Node.js, SQLite'), ['VUE', 'NODE.JS', 'SQLITE']);
  assert.deepEqual(projectPresentation.skillTags('vue' + ideographicComma + 'html'), ['VUE', 'HTML']);
  assert.deepEqual(projectPresentation.skillTags('vue' + fullwidthComma + 'html'), ['VUE', 'HTML']);
  assert.deepEqual(projectPresentation.skillTags('vue, html'), ['VUE', 'HTML']);
  assert.deepEqual(projectPresentation.skillTags('Vue' + ideographicComma + 'vue' + fullwidthComma + 'HTML, html'), ['VUE', 'HTML']);
  assert.deepEqual(projectPresentation.skillTags(''), []);
  assert.equal(projectPresentation.isProjectFull({ current_members: 4, max_members: 4, status: 'open' }), true);
  assert.equal(projectPresentation.isProjectFull({ current_members: 1, max_members: 4, status: 'full' }), true);
  assert.equal(projectPresentation.canApplyToProject({
    owner_id: 1,
    current_members: 4,
    max_members: 4,
    status: 'open',
    accepting_applications: true
  }, { id: 2 }), false);
  assert.equal(projectPresentation.capacityText({ current_members: 2, max_members: 4 }), '人數：2 / 4');
  assert.equal(projectPresentation.favoriteText({ is_favorited: 1 }), '取消收藏');
  assert.equal(projectPresentation.favoriteText({ is_favorited: 0 }), '⭐');
});

test('home popular skill counts use the shared normalized skill parser', function() {
  var homeView = readClient('src/views/HomeView.vue');

  assert.match(homeView, /import \{ skillTags \} from '..\/utils\/projectPresentation'/);
  assert.match(homeView, /skillTags\(project\.required_skills\)/);
  assert.doesNotMatch(homeView, /\.split\('\,'\)/);
});

test('home popular skill counts scan all groups instead of the filtered list', function() {
  var homeView = readClient('src/views/HomeView.vue');

  assert.match(homeView, /const skillStatProjects = ref\(\[\]\)/);
  assert.match(homeView, /async function loadSkillStatProjects\(\)/);
  assert.ok(homeView.includes("const response = await api.get('/projects',"));
  assert.ok(homeView.includes('params: { include_owned: 1 }'));
  assert.match(homeView, /skillStatProjects\.value = response\.data\.projects \|\| \[\]/);
  assert.match(homeView, /skillStatProjects\.value\.forEach\(\(project\) => \{/);
  assert.doesNotMatch(homeView, /popularSkills = computed\(\(\) => \{[\s\S]*?projects\.value\.forEach\(\(project\) => \{/);
  assert.match(homeView, /await Promise\.all\(\[loadProjects\(\), loadSkillStatProjects\(\)\]\)/);
  assert.equal((homeView.match(/loadSkillStatProjects\(\)/g) || []).length, 3);
});

test('home project list wires favorite filtering and project card favorite events', function() {
  var homeView = readClient('src/views/HomeView.vue');
  var projects = readClient('src/composables/useProjects.js');
  var projectCard = readClient('src/components/ProjectCard.vue');
  var style = readClient('src/assets/style.css');

  assert.match(projects, /filter:\s*filters\.filter/);
  assert.match(homeView, /toggleFavorite/);
  assert.match(projectCard, /favoriteText/);
  assert.match(projectCard, /skillTags/);
  assert.match(projectCard, /favorite/);
  assert.match(style, /\.skill-tags/);
  assert.match(style, /\.favorite-button/);
});

test('project cards show logged-in skill match percent without a capacity progress bar', function() {
  var projectCard = readClient('src/components/ProjectCard.vue');
  var style = readClient('src/assets/style.css');

  assert.doesNotMatch(projectCard, /class="capacity-bar"/);
  assert.doesNotMatch(projectCard, /class="capacity-bar-fill"/);
  assert.doesNotMatch(projectCard, /capacityPercent/);
  assert.match(projectCard, /const matchPercent = computed/);
  assert.match(projectCard, /props\.user\?\.skills/);
  assert.match(projectCard, /class="match-badge"/);
  assert.match(projectCard, /Match \{\{ matchPercent \}\}%/);
  assert.doesNotMatch(style, /\.capacity-bar/);
  assert.doesNotMatch(style, /\.capacity-bar-fill/);
  assert.match(style, /\.match-badge/);
});

test('home toolbar keeps refresh beside status and uses compact favorite buttons', function() {
  var homeView = readClient('src/views/HomeView.vue');
  var projectCard = readClient('src/components/ProjectCard.vue');
  var style = readClient('src/assets/style.css');
  var statusIndex = homeView.indexOf('v-model="filters.status"');
  var refreshIndex = homeView.indexOf('@click="loadProjects"');
  var favoriteFilterIndex = homeView.indexOf('v-model="filters.filter"');

  assert.ok(statusIndex >= 0);
  assert.ok(refreshIndex > statusIndex);
  assert.ok(favoriteFilterIndex > refreshIndex);
  assert.match(projectCard, /favorite-button compact/);
  assert.match(style, /\.favorite-button\.compact/);
  assert.match(style, /width:\s*auto/);
});

test('home view owns the admin entry below the main navbar instead of the group sidebar', function() {
  var homeView = readClient('src/views/HomeView.vue');
  var groupSidebar = readClient('src/components/GroupSidebar.vue');
  var navbarIndex = homeView.indexOf('<MainNavbar />');
  var adminEntryIndex = homeView.indexOf('class="admin-entry-button"');

  assert.ok(navbarIndex >= 0);
  assert.ok(adminEntryIndex > navbarIndex);
  assert.match(homeView, /v-if="isAdmin"/);
  assert.match(homeView, /:to="\{ name: 'admin' \}"/);
  assert.match(homeView, /role === 'admin'/);
  assert.match(homeView, /role === 'super_admin'/);
  assert.doesNotMatch(groupSidebar, /admin-entry-button/);
  assert.doesNotMatch(groupSidebar, /name: 'admin'/);
  assert.doesNotMatch(groupSidebar, /isAdmin/);
});

test('group sidebar tabs do not scale or lift on hover', function() {
  var groupSidebar = readClient('src/components/GroupSidebar.vue');
  var style = readClient('src/assets/style.css');
  var hoverBlock = style.slice(
    style.indexOf('.group-tabs button:hover'),
    style.indexOf('.group-list,', style.indexOf('.group-tabs button:hover'))
  );

  assert.match(groupSidebar, /class="segmented group-tabs"/);
  assert.match(groupSidebar, />\s*全部 \{\{ counts\.all \}\}/);
  assert.match(groupSidebar, />\s*已加入 \{\{ counts\.joined \}\}/);
  assert.match(groupSidebar, />\s*我建立 \{\{ counts\.owned \}\}/);
  assert.match(hoverBlock, /transform:\s*none/);
  assert.match(hoverBlock, /box-shadow:\s*none/);
  assert.doesNotMatch(hoverBlock, /scale\(/);
  assert.doesNotMatch(hoverBlock, /translateY\(/);
});
