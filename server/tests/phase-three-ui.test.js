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

test('group detail places announcement bar above discussion', function() {
  var groupView = readClient('src/views/GroupView.vue');
  var announcementIndex = groupView.indexOf('<AnnouncementBar');
  var discussionIndex = groupView.indexOf('class="panel discussion-panel"');

  assert.ok(announcementIndex >= 0);
  assert.ok(discussionIndex > announcementIndex);
  assert.match(groupView, /announcementModalOpen/);
  assert.match(groupView, /AnnouncementModal/);
  assert.match(groupView, /\/announcements/);
  assert.doesNotMatch(groupView, /deadline-summary/);
  assert.doesNotMatch(groupView, /deadlineModalOpen/);
  assert.doesNotMatch(groupView, /\/deadlines/);
});

test('announcement bar uses countdown-style cards and modal content can scroll', function() {
  var announcementBar = readClient('src/components/AnnouncementBar.vue');
  var announcementModal = readClient('src/components/AnnouncementModal.vue');

  assert.match(announcementBar, /announcement-bar/);
  assert.match(announcementBar, /announcement-card/);
  assert.match(announcementBar, /countdown-scroll/);
  assert.match(announcementBar, /white-space:\s*nowrap/);
  assert.match(announcementBar, /text-overflow:\s*ellipsis/);
  assert.match(announcementModal, /floating-modal-backdrop/);
  assert.match(announcementModal, /announcement-modal/);
  assert.match(announcementModal, /@click="\$emit\('delete', announcement\)"/);
});
