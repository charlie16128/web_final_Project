var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var http = require('node:http');
var os = require('node:os');
var path = require('node:path');

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
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamup-phase-two-'));
  var previousDbPath = process.env.TEAMUP_DB_PATH;
  var previousJwtSecret = process.env.JWT_SECRET;
  process.env.TEAMUP_DB_PATH = path.join(tempDir, 'test.sqlite');
  process.env.JWT_SECRET = 'phase-two-test-secret';
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
    name: 'Phase Two User ' + suffix,
    student_id: 'D72222' + suffix,
    email: 'phase-two-' + suffix + '@example.com',
    password: 'abc123'
  });
  assert.equal(response.status, 201);
  return response.body;
}

async function createProject(app, token) {
  var response = await request(app, 'POST', '/api/projects', {
    title: 'Phase Two Project',
    description: 'Role based group management test',
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

test('leaders manage vice leaders and vice leaders can manage ordinary group work', async function() {
  var ctx = createContext();
  try {
    var leader = await register(ctx.app, '01');
    var viceLeader = await register(ctx.app, '02');
    var member = await register(ctx.app, '03');
    var invitedByVice = await register(ctx.app, '04');
    var outsider = await register(ctx.app, '05');
    var project = await createProject(ctx.app, leader.token);

    await inviteAndAccept(ctx.app, project.id, leader.token, viceLeader);
    await inviteAndAccept(ctx.app, project.id, leader.token, member);

    var initialMembers = await request(ctx.app, 'GET', '/api/groups/' + project.id + '/members', null, leader.token);
    assert.equal(initialMembers.status, 200);
    assert.deepEqual(initialMembers.body.members.map(function(item) {
      return item.group_role;
    }), ['leader', 'member', 'member']);

    var outsiderPromotion = await request(ctx.app, 'PATCH', '/api/groups/' + project.id + '/members/' + viceLeader.user.id + '/role', {
      role: 'vice_leader'
    }, outsider.token);
    assert.equal(outsiderPromotion.status, 403);

    var promoted = await request(ctx.app, 'PATCH', '/api/groups/' + project.id + '/members/' + viceLeader.user.id + '/role', {
      role: 'vice_leader'
    }, leader.token);
    assert.equal(promoted.status, 200);
    assert.equal(promoted.body.member.group_role, 'vice_leader');

    var viceGroup = await request(ctx.app, 'GET', '/api/groups/' + project.id, null, viceLeader.token);
    assert.equal(viceGroup.status, 200);
    assert.equal(viceGroup.body.group.group_role, 'vice_leader');
    assert.equal(viceGroup.body.group.can_manage, true);

    var edited = await request(ctx.app, 'PATCH', '/api/groups/' + project.id, {
      title: 'Phase Two Edited By Vice Leader',
      description: 'Vice leader can edit group details',
      max_members: 5,
      accepting_applications: true
    }, viceLeader.token);
    assert.equal(edited.status, 200);
    assert.equal(edited.body.project.title, 'Phase Two Edited By Vice Leader');

    await inviteAndAccept(ctx.app, project.id, viceLeader.token, invitedByVice);

    var removed = await request(ctx.app, 'DELETE', '/api/groups/' + project.id + '/members/' + member.user.id, null, viceLeader.token);
    assert.equal(removed.status, 200);
    assert.equal(removed.body.member_id, member.user.id);

    var deniedTransfer = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/transfer-owner', {
      user_id: viceLeader.user.id
    }, viceLeader.token);
    assert.equal(deniedTransfer.status, 403);

    var deniedDelete = await request(ctx.app, 'DELETE', '/api/projects/' + project.id, null, viceLeader.token);
    assert.equal(deniedDelete.status, 403);

    var demoted = await request(ctx.app, 'PATCH', '/api/groups/' + project.id + '/members/' + viceLeader.user.id + '/role', {
      role: 'member'
    }, leader.token);
    assert.equal(demoted.status, 200);
    assert.equal(demoted.body.member.group_role, 'member');

    var deniedAfterDemotion = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/invitations', {
      user_id: outsider.user.id
    }, viceLeader.token);
    assert.equal(deniedAfterDemotion.status, 403);

    var deleted = await request(ctx.app, 'DELETE', '/api/groups/' + project.id, null, leader.token);
    assert.equal(deleted.status, 200);
  } finally {
    await ctx.cleanup();
  }
});

test('admin-owned groups keep leader role so vice leader controls appear', async function() {
  var ctx = createContext();
  try {
    var admin = await request(ctx.app, 'POST', '/api/login', {
      email: 'admin@gmail.com',
      password: 'admin2006'
    });
    assert.equal(admin.status, 200);

    var member = await register(ctx.app, '06');
    var project = await createProject(ctx.app, admin.body.token);
    await inviteAndAccept(ctx.app, project.id, admin.body.token, member);

    var group = await request(ctx.app, 'GET', '/api/groups/' + project.id, null, admin.body.token);
    assert.equal(group.status, 200);
    assert.equal(group.body.group.relation, 'owned');
    assert.equal(group.body.group.group_role, 'leader');

    var promoted = await request(ctx.app, 'PATCH', '/api/groups/' + project.id + '/members/' + member.user.id + '/role', {
      role: 'vice_leader'
    }, admin.body.token);
    assert.equal(promoted.status, 200);
    assert.equal(promoted.body.member.group_role, 'vice_leader');
  } finally {
    await ctx.cleanup();
  }
});
