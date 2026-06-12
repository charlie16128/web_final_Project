var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

function read(filePath) {
  return fs.readFileSync(path.join(__dirname, '..', filePath), 'utf8');
}

test('homepage opens account settings in a centered modal for email and password only', function() {
  var html = read('public/index.html');
  var main = read('public/javascripts/main.js');

  assert.match(html, /@submit\.prevent="saveAccountSettings"/);
  assert.match(html, /class="account-modal-backdrop"/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /accountForm\.email/);
  assert.match(html, /accountForm\.password/);
  assert.match(html, /:value="user\.student_id"/);
  assert.match(html, /:value="user\.name"/);
  assert.doesNotMatch(html, /class="account-menu"/);
  assert.doesNotMatch(html, /v-model[^>]+user\.student_id/);
  assert.doesNotMatch(html, /v-model[^>]+user\.name/);
  assert.match(main, /showAccountModal/);
  assert.match(main, /openAccountModal: function/);
  assert.match(main, /closeAccountModal: function/);
  assert.match(main, /saveAccountSettings: function/);
});
