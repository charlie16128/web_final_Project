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
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamup-phase-four-'));
  var previousDbPath = process.env.TEAMUP_DB_PATH;
  var previousJwtSecret = process.env.JWT_SECRET;
  process.env.TEAMUP_DB_PATH = path.join(tempDir, 'test.sqlite');
  process.env.JWT_SECRET = 'phase-four-test-secret';
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
    name: 'Phase Four User ' + suffix,
    student_id: 'D84445' + suffix,
    email: 'phase-four-' + suffix + '@example.com',
    password: 'abc123'
  });
  assert.equal(response.status, 201);
  return response.body;
}

async function createProject(app, token, maxMembers) {
  var response = await request(app, 'POST', '/api/projects', {
    title: 'Phase Four Project',
    description: 'Project team management test',
    max_members: maxMembers || 3,
    accepting_applications: true
  }, token);
  assert.equal(response.status, 201);
  return response.body.project;
}

test('project owners invite users and invitees accept or reject invitations', async function() {
  var ctx = createContext();
  try {
    var owner = await register(ctx.app, '01');
    var invitee = await register(ctx.app, '02');
    var outsider = await register(ctx.app, '03');
    var project = await createProject(ctx.app, owner.token, 3);

    var denied = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/invitations', {
      user_id: invitee.user.id
    }, outsider.token);
    assert.equal(denied.status, 403);

    var invalidStudentId = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/invitations', {
      user_id: 'D123'
    }, owner.token);
    assert.equal(invalidStudentId.status, 400);
    assert.match(invalidStudentId.body.message, /學號格式/);

    var invited = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/invitations', {
      user_id: invitee.user.id,
      message: 'Join our final project'
    }, owner.token);
    assert.equal(invited.status, 201);
    assert.equal(invited.body.invitation.invitee_id, invitee.user.id);
    assert.equal(invited.body.invitation.status, 'pending');

    var pendingMembers = await request(ctx.app, 'GET', '/api/groups/' + project.id + '/members', null, owner.token);
    assert.equal(pendingMembers.status, 200);
    assert.deepEqual(pendingMembers.body.members.map(function(member) {
      return member.group_role;
    }), ['leader', 'invited']);

    var inviteeList = await request(ctx.app, 'GET', '/api/me/invitations', null, invitee.token);
    assert.equal(inviteeList.status, 200);
    assert.deepEqual(inviteeList.body.invitations.map(function(item) {
      return item.project_title;
    }), ['Phase Four Project']);

    var accepted = await request(ctx.app, 'POST', '/api/invitations/' + invited.body.invitation.id + '/accept', null, invitee.token);
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.invitation.status, 'accepted');

    var inviteeListAfterAccept = await request(ctx.app, 'GET', '/api/me/invitations', null, invitee.token);
    assert.equal(inviteeListAfterAccept.status, 200);
    assert.deepEqual(inviteeListAfterAccept.body.invitations, []);

    var joinedGroup = await request(ctx.app, 'GET', '/api/groups/' + project.id, null, invitee.token);
    assert.equal(joinedGroup.status, 200);
    assert.equal(joinedGroup.body.group.relation, 'joined');

    var members = await request(ctx.app, 'GET', '/api/groups/' + project.id + '/members', null, owner.token);
    assert.equal(members.status, 200);
    assert.deepEqual(members.body.members.map(function(member) {
      return member.relation;
    }), ['owned', 'joined']);

    var left = await request(ctx.app, 'DELETE', '/api/groups/' + project.id + '/membership', null, invitee.token);
    assert.equal(left.status, 200);

    var reinvited = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/invitations', {
      user_id: invitee.user.id
    }, owner.token);
    assert.equal(reinvited.status, 201);
    assert.equal(reinvited.body.invitation.status, 'pending');

    var rejectedInvitee = await register(ctx.app, '04');
    var secondInvite = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/invitations', {
      user_id: rejectedInvitee.user.id
    }, owner.token);
    assert.equal(secondInvite.status, 201);

    var rejected = await request(ctx.app, 'POST', '/api/invitations/' + secondInvite.body.invitation.id + '/reject', null, rejectedInvitee.token);
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.invitation.status, 'rejected');

    var rejectedGroup = await request(ctx.app, 'GET', '/api/groups/' + project.id, null, rejectedInvitee.token);
    assert.equal(rejectedGroup.status, 200);
    assert.equal(rejectedGroup.body.group.relation, 'public');
    assert.equal(rejectedGroup.body.group.can_view_private_area, false);
  } finally {
    await ctx.cleanup();
  }
});

test('full projects block applications, invitations, and pending invitation acceptance', async function() {
  var ctx = createContext();
  try {
    var owner = await register(ctx.app, '05');
    var invitee = await register(ctx.app, '06');
    var lateUser = await register(ctx.app, '07');
    var project = await createProject(ctx.app, owner.token, 2);

    var invite = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/invitations', {
      user_id: invitee.user.id
    }, owner.token);
    assert.equal(invite.status, 201);

    var accepted = await request(ctx.app, 'POST', '/api/invitations/' + invite.body.invitation.id + '/accept', null, invitee.token);
    assert.equal(accepted.status, 200);

    var publicProject = await request(ctx.app, 'GET', '/api/projects/' + project.id, null, lateUser.token);
    assert.equal(publicProject.body.project.current_members, 2);
    assert.equal(publicProject.body.project.status, 'full');

    var lateInvite = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/invitations', {
      user_id: lateUser.user.id
    }, owner.token);
    assert.equal(lateInvite.status, 400);

    var lateApply = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/apply', {
      message: 'Can I join?'
    }, lateUser.token);
    assert.equal(lateApply.status, 400);

    await request(ctx.app, 'DELETE', '/api/groups/' + project.id + '/membership', null, invitee.token);

    var reopenedInvite = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/invitations', {
      user_id: lateUser.user.id
    }, owner.token);
    assert.equal(reopenedInvite.status, 201);
  } finally {
    await ctx.cleanup();
  }
});

test('project owners transfer leadership to an accepted member', async function() {
  var ctx = createContext();
  try {
    var owner = await register(ctx.app, '08');
    var member = await register(ctx.app, '09');
    var outsider = await register(ctx.app, '10');
    var project = await createProject(ctx.app, owner.token, 4);

    var invite = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/invitations', {
      user_id: member.user.id
    }, owner.token);
    assert.equal(invite.status, 201);
    await request(ctx.app, 'POST', '/api/invitations/' + invite.body.invitation.id + '/accept', null, member.token);

    var rejected = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/transfer-owner', {
      user_id: outsider.user.id
    }, owner.token);
    assert.equal(rejected.status, 400);

    var transferred = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/transfer-owner', {
      user_id: member.user.id
    }, owner.token);
    assert.equal(transferred.status, 200);
    assert.equal(transferred.body.project.owner_id, member.user.id);

    var oldOwnerGroup = await request(ctx.app, 'GET', '/api/groups/' + project.id, null, owner.token);
    assert.equal(oldOwnerGroup.status, 200);
    assert.equal(oldOwnerGroup.body.group.relation, 'joined');

    var newOwnerGroup = await request(ctx.app, 'GET', '/api/groups/' + project.id, null, member.token);
    assert.equal(newOwnerGroup.status, 200);
    assert.equal(newOwnerGroup.body.group.relation, 'owned');

    var announcement = await request(ctx.app, 'POST', '/api/groups/' + project.id + '/announcements', {
      content: 'New leader can manage this group.'
    }, member.token);
    assert.equal(announcement.status, 201);
  } finally {
    await ctx.cleanup();
  }
});

test('project owners remove accepted members from team management', async function() {
  var ctx = createContext();
  try {
    var owner = await register(ctx.app, '11');
    var member = await register(ctx.app, '12');
    var outsider = await register(ctx.app, '13');
    var project = await createProject(ctx.app, owner.token, 2);

    var invite = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/invitations', {
      user_id: member.user.id
    }, owner.token);
    assert.equal(invite.status, 201);

    var accepted = await request(ctx.app, 'POST', '/api/invitations/' + invite.body.invitation.id + '/accept', null, member.token);
    assert.equal(accepted.status, 200);

    var denied = await request(ctx.app, 'DELETE', '/api/groups/' + project.id + '/members/' + member.user.id, null, outsider.token);
    assert.equal(denied.status, 403);

    var selfRemoval = await request(ctx.app, 'DELETE', '/api/groups/' + project.id + '/members/' + owner.user.id, null, owner.token);
    assert.equal(selfRemoval.status, 400);

    var removed = await request(ctx.app, 'DELETE', '/api/groups/' + project.id + '/members/' + member.user.id, null, owner.token);
    assert.equal(removed.status, 200);
    assert.equal(removed.body.member_id, member.user.id);

    var removedGroup = await request(ctx.app, 'GET', '/api/groups/' + project.id, null, member.token);
    assert.equal(removedGroup.status, 200);
    assert.equal(removedGroup.body.group.relation, 'public');
    assert.equal(removedGroup.body.group.can_view_private_area, false);

    var reopened = await request(ctx.app, 'GET', '/api/projects/' + project.id, null, outsider.token);
    assert.equal(reopened.status, 200);
    assert.equal(reopened.body.project.current_members, 1);
    assert.equal(reopened.body.project.status, 'open');
  } finally {
    await ctx.cleanup();
  }
});
