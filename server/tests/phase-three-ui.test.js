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

test('group detail places announcement and deadline summaries above discussion', function() {
  var groupView = readClient('src/views/GroupView.vue');
  var announcementIndex = groupView.indexOf('class="summary-strip announcement-summary"');
  var deadlineIndex = groupView.indexOf('class="summary-strip deadline-summary"');
  var discussionIndex = groupView.indexOf('class="panel discussion-panel"');

  assert.ok(announcementIndex >= 0);
  assert.ok(deadlineIndex > announcementIndex);
  assert.ok(discussionIndex > deadlineIndex);
  assert.match(groupView, /announcementModalOpen/);
  assert.match(groupView, /deadlineModalOpen/);
  assert.match(groupView, /\/announcements/);
  assert.match(groupView, /\/deadlines/);
});

test('announcement and deadline summaries stay single-line and modal content can scroll', function() {
  var style = readClient('src/assets/style.css');

  assert.match(style, /\.summary-strip/);
  assert.match(style, /white-space:\s*nowrap/);
  assert.match(style, /text-overflow:\s*ellipsis/);
  assert.match(style, /\.floating-modal-backdrop/);
  assert.match(style, /\.floating-modal/);
  assert.match(style, /max-height:\s*calc\(100vh - 40px\)/);
  assert.match(style, /overflow-y:\s*auto/);
});
