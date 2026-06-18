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

test('group detail wires owner invitation and leader transfer controls', function() {
  var groupView = readClient('src/views/GroupView.vue');

  assert.match(groupView, /team-management-panel/);
  assert.match(groupView, /inviteForm/);
  assert.match(groupView, /transferForm/);
  assert.match(groupView, /inviteModalOpen/);
  assert.match(groupView, /transferModalOpen/);
  assert.match(groupView, /team-management-actions/);
  assert.match(groupView, /invite-member-form/);
  assert.match(groupView, /transfer-owner-form/);
  assert.match(groupView, /removeMember/);
  assert.match(groupView, /loadMembers/);
  assert.match(groupView, /\/groups\/\$\{route\.params\.id\}\/members/);
  assert.match(groupView, /\/groups\/\$\{group\.value\.id\}\/members\/\$\{member\.id\}/);
  assert.match(groupView, /\/groups\/\$\{group\.value\.id\}\/invitations/);
  assert.match(groupView, /\/projects\/\$\{group\.value\.id\}\/transfer-owner/);
  assert.match(groupView, /isGroupFull/);
  assert.match(groupView, /:disabled="isGroupFull"/);
  assert.match(groupView, /public-group-layout/);
  assert.match(groupView, /成員列表/);
  assert.match(groupView, /v-if="canManageGroupDetails" class="team-management-actions/);
});

test('applications invitations view lists pending invitations with accept and reject actions', function() {
  var applicationsInvitationsView = readClient('src/views/ApplicationsInvitationsView.vue');
  var invitationsComposable = readClient('src/composables/useGroupsAndInvitations.js');

  assert.match(applicationsInvitationsView, /myInvitations/);
  assert.match(applicationsInvitationsView, /loadMyInvitations/);
  assert.match(applicationsInvitationsView, /selectTab\('invitations'\)/);
  assert.match(applicationsInvitationsView, /acceptInvitation/);
  assert.match(applicationsInvitationsView, /rejectInvitation/);
  assert.match(invitationsComposable, /\/me\/invitations/);
  assert.match(invitationsComposable, /\/invitations\/\$\{invitation\.id\}\/accept/);
  assert.match(invitationsComposable, /\/invitations\/\$\{invitation\.id\}\/reject/);
});

test('team management controls have responsive layout styles', function() {
  var style = readClient('src/assets/style.css');

  assert.match(style, /\.team-management-panel/);
  assert.match(style, /\.team-management-grid/);
  assert.match(style, /\.team-management-actions/);
  assert.match(style, /\.team-management-form/);
  assert.match(style, /\.team-management-form button\[type="submit"\]/);
  assert.match(style, /margin-top:\s*auto/);
  assert.match(style, /\.member-row/);
  assert.match(style, /\.invite-list/);
});
