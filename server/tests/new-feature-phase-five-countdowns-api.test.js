var assert = require('node:assert/strict');
var fs = require('node:fs');
var http = require('node:http');
var os = require('node:os');
var path = require('node:path');
var test = require('node:test');

function clearAppModules() {
  [
    '../database/db',
    '../middleware/auth',
    '../routes/api',
    '../app'
  ].forEach(function(modulePath) {
    delete require.cache[require.resolve(modulePath)];
  });
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function createContext() {
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamup-phase-five-countdowns-'));
  var previousDbPath = process.env.TEAMUP_DB_PATH;
  var previousJwtSecret = process.env.JWT_SECRET;
  process.env.TEAMUP_DB_PATH = path.join(tempDir, 'test.sqlite');
  process.env.JWT_SECRET = 'phase-five-countdowns-test-secret';
  clearAppModules();

  return {
    app: require('../app'),
    db: require('../database/db'),
    cleanup: async function() {
      await this.db.close();
      clearAppModules();
      restoreEnv('TEAMUP_DB_PATH', previousDbPath);
      restoreEnv('JWT_SECRET', previousJwtSecret);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

function request(app, method, url, body, token) {
  return new Promise(function(resolve, reject) {
    var server = app.listen(0, function() {
      var payload = body ? JSON.stringify(body) : '';
      var options = {
        hostname: '127.0.0.1',
        port: server.address().port,
        path: url,
        method: method,
        headers: {}
      };

      if (payload) {
        options.headers['Content-Type'] = 'application/json';
        options.headers['Content-Length'] = Buffer.byteLength(payload);
      }
      if (token) {
        options.headers.Authorization = 'Bearer ' + token;
      }

      var req = http.request(options, function(res) {
        var text = '';
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
          text += chunk;
        });
        res.on('end', function() {
          server.close(function() {
            resolve({ status: res.statusCode, body: text ? JSON.parse(text) : {} });
          });
        });
      });

      req.on('error', function(err) {
        server.close(function() {
          reject(err);
        });
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  });
}

async function register(app, suffix) {
  var response = await request(app, 'POST', '/api/register', {
    name: 'Phase Five User ' + suffix,
    student_id: 'D75555' + suffix,
    email: 'phase-five-countdown-' + suffix + '@example.com',
    password: 'abc123'
  });
  assert.equal(response.status, 201);
  return response.body;
}

async function createProject(app, token) {
  var response = await request(app, 'POST', '/api/projects', {
    title: 'Phase Five Project',
    description: 'Countdown API test group',
    max_members: 5,
    accepting_applications: true
  }, token);
  assert.equal(response.status, 201);
  return response.body.project;
}

async function inviteAndAccept(app, projectId, inviterToken, invitee) {
  var invite = await request(app, 'POST', '/api/groups/' + projectId + '/invitations', {
    user_id: invitee.user.id
  }, inviterToken);
  assert.equal(invite.status, 201);

  var accepted = await request(app, 'POST', '/api/invitations/' + invite.body.invitation.id + '/accept', null, invitee.token);
  assert.equal(accepted.status, 200);
}

test('countdown datetime-local values are interpreted as UTC+8', async function() {
  var previousTz = process.env.TZ;
  process.env.TZ = 'UTC';

  var ctx = createContext();
  try {
    var leader = await register(ctx.app, '11');
    var project = await createProject(ctx.app, leader.token);

    var created = await request(ctx.app, 'POST', '/api/groups/' + project.id + '/countdowns', {
      title: 'Taipei local deadline',
      target_time: '2099-03-10T18:45'
    }, leader.token);
    assert.equal(created.status, 201);
    assert.equal(created.body.countdown.target_time, '2099-03-10T10:45:00.000Z');

    var updated = await request(ctx.app, 'PATCH', '/api/groups/' + project.id + '/countdowns/' + created.body.countdown.id, {
      title: 'Updated Taipei local deadline',
      target_time: '2099-03-11T08:15'
    }, leader.token);
    assert.equal(updated.status, 200);
    assert.equal(updated.body.countdown.target_time, '2099-03-11T00:15:00.000Z');
  } finally {
    await ctx.cleanup();
    restoreEnv('TZ', previousTz);
  }
});
test('group members create multiple countdowns and authorized users manage them', async function() {
  var ctx = createContext();
  try {
    var table = await ctx.db.get('SELECT name FROM sqlite_master WHERE type = "table" AND name = "group_countdowns"');
    assert.equal(table.name, 'group_countdowns');

    var leader = await register(ctx.app, '01');
    var creator = await register(ctx.app, '02');
    var otherMember = await register(ctx.app, '03');
    var outsider = await register(ctx.app, '04');
    var project = await createProject(ctx.app, leader.token);
    await inviteAndAccept(ctx.app, project.id, leader.token, creator);
    await inviteAndAccept(ctx.app, project.id, leader.token, otherMember);

    var later = await request(ctx.app, 'POST', '/api/groups/' + project.id + '/countdowns', {
      title: 'Final presentation rehearsal',
      description: 'Bring slides and demo notes',
      target_time: '2099-02-01T12:30:00.000Z'
    }, creator.token);
    assert.equal(later.status, 201);
    assert.equal(later.body.countdown.created_by, creator.user.id);

    var earlier = await request(ctx.app, 'POST', '/api/groups/' + project.id + '/countdowns', {
      title: 'Prototype demo',
      description: 'Show the first usable build',
      target_time: '2099-01-15T09:00:00.000Z'
    }, creator.token);
    assert.equal(earlier.status, 201);

    var listed = await request(ctx.app, 'GET', '/api/groups/' + project.id + '/countdowns', null, otherMember.token);
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body.countdowns.map(function(countdown) {
      return countdown.title;
    }), ['Prototype demo', 'Final presentation rehearsal']);

    var denied = await request(ctx.app, 'PATCH', '/api/groups/' + project.id + '/countdowns/' + earlier.body.countdown.id, {
      title: 'Hijacked countdown',
      target_time: '2099-01-16T09:00:00.000Z'
    }, otherMember.token);
    assert.equal(denied.status, 403);

    var updatedByCreator = await request(ctx.app, 'PATCH', '/api/groups/' + project.id + '/countdowns/' + earlier.body.countdown.id, {
      title: 'Prototype demo check',
      description: 'Updated owner notes',
      target_time: '2099-01-16T10:00:00.000Z'
    }, creator.token);
    assert.equal(updatedByCreator.status, 200);
    assert.equal(updatedByCreator.body.countdown.title, 'Prototype demo check');

    var invalid = await request(ctx.app, 'POST', '/api/groups/' + project.id + '/countdowns', {
      title: 'Broken countdown',
      target_time: 'not-a-date'
    }, creator.token);
    assert.equal(invalid.status, 400);

    var outsiderDenied = await request(ctx.app, 'GET', '/api/groups/' + project.id + '/countdowns', null, outsider.token);
    assert.equal(outsiderDenied.status, 404);

    var deletedByLeader = await request(ctx.app, 'DELETE', '/api/groups/' + project.id + '/countdowns/' + later.body.countdown.id, null, leader.token);
    assert.equal(deletedByLeader.status, 200);
  } finally {
    await ctx.cleanup();
  }
});
