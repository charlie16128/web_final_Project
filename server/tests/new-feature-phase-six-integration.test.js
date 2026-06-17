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
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamup-phase-six-'));
  var previousDbPath = process.env.TEAMUP_DB_PATH;
  var previousJwtSecret = process.env.JWT_SECRET;
  process.env.TEAMUP_DB_PATH = path.join(tempDir, 'test.sqlite');
  process.env.JWT_SECRET = 'phase-six-integration-test-secret';
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
    name: 'Phase Six User ' + suffix,
    student_id: 'D76666' + suffix,
    email: 'phase-six-' + suffix + '@example.com',
    password: 'abc123'
  });
  assert.equal(response.status, 201);
  return response.body;
}

async function createProject(app, token) {
  var response = await request(app, 'POST', '/api/projects', {
    title: 'Phase Six Project',
    description: 'Full feature integration checks',
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

test('phase six integration keeps roles ban expiry and countdowns working together', async function() {
  var ctx = createContext();
  try {
    var leader = await register(ctx.app, '01');
    var member = await register(ctx.app, '02');
    var promoted = await register(ctx.app, '03');
    var project = await createProject(ctx.app, leader.token);
    await inviteAndAccept(ctx.app, project.id, leader.token, member);
    await inviteAndAccept(ctx.app, project.id, leader.token, promoted);

    var memberPromotion = await request(ctx.app, 'PATCH', '/api/groups/' + project.id + '/members/' + promoted.user.id + '/role', {
      role: 'vice_leader'
    }, member.token);
    assert.equal(memberPromotion.status, 403);

    var promotedToVice = await request(ctx.app, 'PATCH', '/api/groups/' + project.id + '/members/' + promoted.user.id + '/role', {
      role: 'vice_leader'
    }, leader.token);
    assert.equal(promotedToVice.status, 200);

    var viceTransfer = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/transfer-owner', {
      user_id: promoted.user.id
    }, promoted.token);
    assert.equal(viceTransfer.status, 403);

    var countdownA = await request(ctx.app, 'POST', '/api/groups/' + project.id + '/countdowns', {
      title: 'First countdown item',
      target_time: '2099-01-01T00:00:00.000Z'
    }, member.token);
    assert.equal(countdownA.status, 201);
    var countdownB = await request(ctx.app, 'POST', '/api/groups/' + project.id + '/countdowns', {
      title: 'Second countdown item',
      target_time: '2099-01-02T00:00:00.000Z'
    }, promoted.token);
    assert.equal(countdownB.status, 201);

    var countdowns = await request(ctx.app, 'GET', '/api/groups/' + project.id + '/countdowns', null, leader.token);
    assert.equal(countdowns.status, 200);
    assert.equal(countdowns.body.countdowns.length, 2);

    var adminLogin = await request(ctx.app, 'POST', '/api/login', {
      email: 'admin@gmail.com',
      password: 'admin2006'
    });
    assert.equal(adminLogin.status, 200);

    var banned = await request(ctx.app, 'POST', '/api/admin/users/' + member.user.id + '/ban', {
      reason: 'Phase six temporary ban',
      seconds: 1
    }, adminLogin.body.token);
    assert.equal(banned.status, 200);

    await ctx.db.run(
      'UPDATE users SET suspended_until = ?, banned_until = ? WHERE student_id = ?',
      ['2000-01-01T00:00:00.000Z', '2000-01-01T00:00:00.000Z', member.user.id]
    );

    var loginAfterExpiry = await request(ctx.app, 'POST', '/api/login', {
      email: member.user.email,
      password: 'abc123'
    });
    assert.equal(loginAfterExpiry.status, 200);
  } finally {
    await ctx.cleanup();
  }
});
