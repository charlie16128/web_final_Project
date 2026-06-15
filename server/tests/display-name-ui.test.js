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

test('display name utility marks admin roles with the admin prefix', async function() {
  var moduleUrl = url.pathToFileURL(clientPath('src/utils/displayName.js')).href;
  var displayName = await import(moduleUrl);

  assert.equal(displayName.isAdminUser({ role: 'admin' }), true);
  assert.equal(displayName.isAdminUser({ role: 'super_admin' }), true);
  assert.equal(displayName.isAdminUser({ role: 'user' }), false);
  assert.equal(displayName.formatDisplayName({ name: 'Admin User', role: 'admin' }), '[ADMIN] Admin User');
  assert.equal(displayName.formatDisplayName({ username: 'admin2006', role: 'super_admin' }), '[ADMIN] admin2006');
  assert.equal(displayName.formatDisplayName({ name: 'Normal User', role: 'user' }), 'Normal User');
});

test('visible name components use the shared display-name utility', function() {
  var header = readClient('src/components/AppHeader.vue');
  var projectCard = readClient('src/components/ProjectCard.vue');
  var groupView = readClient('src/views/GroupView.vue');
  var style = readClient('src/assets/style.css');

  assert.match(header, /formatDisplayName/);
  assert.match(projectCard, /DisplayName/);
  assert.match(groupView, /DisplayName/);
  assert.match(style, /\.admin-prefix/);
});
