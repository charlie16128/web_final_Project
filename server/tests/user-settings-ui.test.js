var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

function readClient(filePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', 'client', filePath), 'utf8');
}

test('account settings moved to a Vue modal for email and password only', function() {
  var home = readClient('src/views/HomeView.vue');
  var modal = readClient('src/components/AccountModal.vue');
  var dashboardBase = readClient('src/composables/useDashboardBase.js');

  assert.match(home, /<AccountModal/);
  assert.match(home, /@save="saveAccountSettings"/);
  assert.match(dashboardBase, /api\.put\('\/users\/me'/);
  assert.match(modal, /class="account-modal-backdrop"/);
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /v-model\.trim="form\.email"/);
  assert.match(modal, /v-model\.trim="form\.password"/);
  assert.match(modal, /:value="user\?\.student_id"/);
  assert.match(modal, /:value="user\?\.name"/);
  assert.doesNotMatch(modal, /v-model[^>]+student_id/);
  assert.doesNotMatch(modal, /v-model[^>]+name/);
});
