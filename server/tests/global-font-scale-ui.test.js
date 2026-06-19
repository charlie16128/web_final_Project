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

test('keeps auth pages at their original font size while scaling the app UI to browser 125 percent', function() {
  var app = readClient('src/App.vue');
  var style = readClient('src/assets/style.css');

  assert.match(app, /app-frame/);
  assert.match(app, /app-frame--auth/);
  assert.match(app, /route\.name === 'login'/);
  assert.match(app, /route\.name === 'register'/);
  assert.match(
    style,
    /\.topbar,\s*[\s\S]*?\.toast\s*\{\s*font-size:\s*15px;\s*\}/
  );
  assert.match(
    style,
    /\.auth-shell,\s*[\s\S]*?\.auth-shell \.toast\s*\{\s*font-size:\s*15px;\s*\}/
  );
  assert.match(style, /\.topbar h1\s*\{\s*font-size:\s*clamp\(28px,\s*4vw,\s*48px\);/);
  assert.match(style, /\.section-title h2\s*\{\s*font-size:\s*21px;/);
  assert.match(style, /\.project-head h2,\s*[\s\S]*?\.modal-head h2\s*\{\s*font-size:\s*24px;/);
  assert.match(style, /\.modal-close\s*\{\s*font-size:\s*18px;/);
  assert.match(style, /\.badge\s*\{\s*font-size:\s*14px;/);
  assert.match(style, /\.message\s*\{\s*font-size:\s*25px;/);
  assert.match(style, /\.message-author\s*\{\s*font-size:\s*18px;/);
  assert.match(style, /\.message-time\s*\{\s*font-size:\s*14px;/);
});

test('scales scoped dashboard widget captions to browser 125 percent', function() {
  var countdownCard = readClient('src/components/CountdownCard.vue');
  var countdownBar = readClient('src/components/CountdownBar.vue');
  var countdownModal = readClient('src/components/CountdownModal.vue');
  var announcementBar = readClient('src/components/AnnouncementBar.vue');
  var announcementModal = readClient('src/components/AnnouncementModal.vue');

  assert.match(countdownCard, /\.countdown-card small\s*\{[\s\S]*font-size:\s*15px;/);
  assert.match(countdownBar, /\.countdown-empty\s*\{[\s\S]*font-size:\s*16px;/);
  assert.match(countdownModal, /\.countdown-detail-grid dt\s*\{[\s\S]*font-size:\s*15px;/);
  assert.match(announcementBar, /\.announcement-card small,\s*[\s\S]*?\.countdown-empty\s*\{[\s\S]*font-size:\s*15px;/);
  assert.match(announcementModal, /\.countdown-detail-grid dt\s*\{[\s\S]*font-size:\s*15px;/);
});
