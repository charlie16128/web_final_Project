var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var test = require('node:test');

var root = path.resolve(__dirname, '..', '..');

function readClient(relativePath) {
  return fs.readFileSync(path.join(root, 'client', relativePath), 'utf8');
}

test('phase four ban modal collects day hour minute and second duration fields', function() {
  var modal = readClient('src/components/FloatingInputModal.vue');
  var adminView = readClient('src/views/AdminView.vue');

  assert.match(modal, /banDuration/);
  assert.match(modal, /v-model\.number="banDuration\.days"/);
  assert.match(modal, /v-model\.number="banDuration\.hours"/);
  assert.match(modal, /v-model\.number="banDuration\.minutes"/);
  assert.match(modal, /v-model\.number="banDuration\.seconds"/);
  assert.match(modal, /days:\s*Number\(banDuration\.value\.days \|\| 0\)/);
  assert.match(modal, /hours:\s*Number\(banDuration\.value\.hours \|\| 0\)/);
  assert.match(modal, /minutes:\s*Number\(banDuration\.value\.minutes \|\| 0\)/);
  assert.match(modal, /seconds:\s*Number\(banDuration\.value\.seconds \|\| 0\)/);
  assert.match(modal, /至少輸入一個大於 0 的時間欄位/);

  assert.match(adminView, /days:\s*payload\.days/);
  assert.match(adminView, /hours:\s*payload\.hours/);
  assert.match(adminView, /minutes:\s*payload\.minutes/);
  assert.match(adminView, /seconds:\s*payload\.seconds/);
});

test('phase four axios interceptor logs out suspended or stale-token responses', function() {
  var api = readClient('src/services/api.js');

  assert.match(api, /error\.response\?\.status === 401/);
  assert.match(api, /error\.response\?\.status === 403/);
  assert.match(api, /message\.includes\('封鎖'\)/);
  assert.match(api, /message\.includes\('停權'\)/);
  assert.match(api, /message\.includes\('登入狀態已失效'\)/);
  assert.match(api, /message\.includes\('登入已失效'\)/);
  assert.match(api, /localStorage\.removeItem\('teamup_token'\)/);
  assert.match(api, /window\.location\.assign\('\/login'\)/);
});
