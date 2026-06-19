var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

function readClient(filePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', 'client', filePath), 'utf8');
}

test('project cards show applied projects as disabled', function() {
  var projectCard = readClient('src/components/ProjectCard.vue');
  var presentation = readClient('src/utils/projectPresentation.js');
  var projects = readClient('src/composables/useProjects.js');

  assert.match(projectCard, /application_status/);
  assert.match(projectCard, /已申請/);
  assert.match(projectCard, /:disabled="!canApply"/);
  assert.match(presentation, /project\?\.application_status !== 'pending'/);
  assert.match(projects, /application_status:\s*project\.application_status/);
  assert.match(projects, /project\.application_status = response\.data\.application\?\.status \|\| 'pending'/);
});

test('account settings and admin member management expose delete account actions', function() {
  var accountModal = readClient('src/components/AccountModal.vue');
  var dashboardBase = readClient('src/composables/useDashboardBase.js');
  var homeView = readClient('src/views/HomeView.vue');
  var adminView = readClient('src/views/AdminView.vue');

  assert.match(accountModal, /delete-account-action/);
  assert.match(accountModal, /delete-account/);
  assert.match(dashboardBase, /api\.delete\('\/users\/me'\)/);
  assert.match(homeView, /@delete-account="deleteAccount"/);
  assert.match(adminView, /toggleBanUser/);
  assert.match(adminView, /deleteUser\(member\)/);
  assert.match(adminView, /\/admin\/users\/\$\{member\.student_id\}/);
  assert.match(adminView, /member\.is_suspended \? '解除停權' : '停權'/);
});
