var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var test = require('node:test');

var root = path.resolve(__dirname, '..', '..');

function readClient(relativePath) {
  return fs.readFileSync(path.join(root, 'client', relativePath), 'utf8');
}

test('phase five adds countdown bar card and modal components', function() {
  var bar = readClient('src/components/CountdownBar.vue');
  var card = readClient('src/components/CountdownCard.vue');
  var modal = readClient('src/components/CountdownModal.vue');

  assert.match(bar, /class="countdown-bar"/);
  assert.match(bar, /class="add-countdown-btn"/);
  assert.match(bar, /class="countdown-scroll"/);
  assert.match(bar, /CountdownCard/);
  assert.match(card, /function shortTitle/);
  assert.match(card, /slice\(0,\s*6\) \+ '\.\.\.'/);
  assert.match(card, /class="countdown-card"/);
  assert.match(modal, /完整標題/);
  assert.match(modal, /完整說明/);
  assert.match(modal, /目標時間/);
  assert.match(modal, /剩餘時間/);
  assert.match(modal, /建立者/);
});

test('phase five group view wires countdown APIs and horizontal row', function() {
  var groupView = readClient('src/views/GroupView.vue');

  assert.match(groupView, /import CountdownBar from '\.\.\/components\/CountdownBar\.vue'/);
  assert.match(groupView, /import CountdownModal from '\.\.\/components\/CountdownModal\.vue'/);
  assert.match(groupView, /<CountdownBar/);
  assert.match(groupView, /:countdowns="countdowns"/);
  assert.match(groupView, /@add="openCreateCountdown"/);
  assert.match(groupView, /@open="openCountdownDetails"/);
  assert.match(groupView, /<CountdownModal/);
  assert.match(groupView, /api\.get\(`\/groups\/\$\{route\.params\.id\}\/countdowns`\)/);
  assert.match(groupView, /api\.post\(`\/groups\/\$\{route\.params\.id\}\/countdowns`/);
  assert.match(groupView, /api\.patch\(`\/groups\/\$\{route\.params\.id\}\/countdowns\/\$\{countdown\.id\}`/);
  assert.match(groupView, /api\.delete\(`\/groups\/\$\{route\.params\.id\}\/countdowns\/\$\{countdown\.id\}`/);
  assert.doesNotMatch(groupView, /deadline-summary/);
  assert.doesNotMatch(groupView, /deadlineModalOpen/);
  assert.doesNotMatch(groupView, /deadlineForm/);
  assert.doesNotMatch(groupView, /loadDeadlines/);
  assert.doesNotMatch(groupView, /\/deadlines/);
});
