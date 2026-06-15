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

  assert.deepEqual(projectPresentation.skillTags('Vue, Node.js, SQLite'), ['Vue', 'Node.js', 'SQLite']);
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
  assert.equal(projectPresentation.favoriteText({ is_favorited: 0 }), '收藏');
});

test('home project list wires favorite filtering and project card favorite events', function() {
  var homeView = readClient('src/views/HomeView.vue');
  var projectCard = readClient('src/components/ProjectCard.vue');
  var style = readClient('src/assets/style.css');

  assert.match(homeView, /filter:\s*filters\.filter/);
  assert.match(homeView, /toggleFavorite/);
  assert.match(projectCard, /favoriteText/);
  assert.match(projectCard, /skillTags/);
  assert.match(projectCard, /favorite/);
  assert.match(style, /\.skill-tags/);
  assert.match(style, /\.favorite-button/);
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
