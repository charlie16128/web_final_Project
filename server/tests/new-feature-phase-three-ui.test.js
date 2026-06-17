var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

function clientPath(filePath) {
  return path.join(__dirname, '..', '..', 'client', filePath);
}

function readClient(filePath) {
  return fs.readFileSync(clientPath(filePath), 'utf8');
}

test('phase three group view wires role-aware team management controls', function() {
  var groupView = readClient('src/views/GroupView.vue');

  assert.match(groupView, /groupRoleLabel/);
  assert.match(groupView, /groupRoleClass/);
  assert.match(groupView, /canTransferLeader/);
  assert.match(groupView, /canSetViceLeader/);
  assert.match(groupView, /canDeleteGroup/);
  assert.match(groupView, /canRemoveMember/);
  assert.match(groupView, /promoteMember/);
  assert.match(groupView, /demoteMember/);
  assert.match(groupView, /updateMemberRole/);
  assert.match(groupView, /member\.group_role/);
  assert.match(groupView, /group-role-badge/);
  assert.match(groupView, /role-action/);
  assert.match(groupView, /member-role-actions/);
  assert.match(groupView, /\/groups\/\$\{group\.value\.id\}\/members\/\$\{member\.id\}\/role/);
});

test('phase three group view uses group endpoints and hides leader-only actions', function() {
  var groupView = readClient('src/views/GroupView.vue');

  assert.match(groupView, /api\.patch\(`\/groups\/\$\{group\.value\.id\}`/);
  assert.match(groupView, /api\.post\(`\/groups\/\$\{group\.value\.id\}\/invitations`/);
  assert.match(groupView, /api\.delete\(`\/groups\/\$\{group\.value\.id\}`/);
  assert.match(groupView, /v-if="canTransferLeader"/);
  assert.match(groupView, /v-if="canSetViceLeader/);
  assert.match(groupView, /v-if="canDeleteGroup"/);
  assert.match(groupView, /:disabled="!canTransferLeader/);
});

test('phase three adds role badge and action styles', function() {
  var style = readClient('src/assets/style.css');

  assert.match(style, /\.group-role-badge/);
  assert.match(style, /\.group-role-badge\.role-leader/);
  assert.match(style, /\.group-role-badge\.role-vice_leader/);
  assert.match(style, /\.member-role-actions/);
  assert.match(style, /\.role-action/);
  assert.match(style, /\.delete-group-action/);
});
