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
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamup-membership-'));
  var previousDbPath = process.env.TEAMUP_DB_PATH;
  var previousJwtSecret = process.env.JWT_SECRET;
  process.env.TEAMUP_DB_PATH = path.join(tempDir, 'test.sqlite');
  process.env.JWT_SECRET = 'membership-test-secret';
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
    name: 'User ' + suffix,
    student_id: 'D22345' + suffix,
    email: 'member' + suffix + '@example.com',
    password: 'abc123'
  });
  assert.equal(response.status, 201);
  return response.body;
}

async function createProject(app, token) {
  var response = await request(app, 'POST', '/api/projects', {
    title: 'Project Alpha',
    description: 'A project for membership tests',
    max_members: 3,
    accepting_applications: true
  }, token);
  assert.equal(response.status, 201);
  return response.body.project;
}

async function acceptMember(app, projectId, ownerToken, memberToken) {
  var applied = await request(app, 'POST', '/api/projects/' + projectId + '/apply', {
    message: 'Please let me join'
  }, memberToken);
  assert.equal(applied.status, 201);

  var accepted = await request(app, 'PUT', '/api/applications/' + applied.body.application.id, {
    status: 'accepted'
  }, ownerToken);
  assert.equal(accepted.status, 200);
}

test('pending applicants can open group details but not discussion, then leave after acceptance', async function() {
  var ctx = createContext();
  try {
    var owner = await register(ctx.app, '01');
    var applicant = await register(ctx.app, '02');
    var project = await createProject(ctx.app, owner.token);

    var applied = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/apply', {
      message: 'Please let me join'
    }, applicant.token);
    assert.equal(applied.status, 201);

    var pendingApplications = await request(ctx.app, 'GET', '/api/my-applications', null, applicant.token);
    assert.equal(pendingApplications.status, 200);
    assert.deepEqual(pendingApplications.body.applications.map(function(item) {
      return item.status;
    }), ['pending']);

    var pendingGroup = await request(ctx.app, 'GET', '/api/groups/' + project.id, null, applicant.token);
    assert.equal(pendingGroup.status, 200);
    assert.equal(pendingGroup.body.group.relation, 'pending');

    var pendingComments = await request(ctx.app, 'GET', '/api/groups/' + project.id + '/comments', null, applicant.token);
    assert.equal(pendingComments.status, 404);

    var accepted = await request(ctx.app, 'PUT', '/api/applications/' + applied.body.application.id, {
      status: 'accepted'
    }, owner.token);
    assert.equal(accepted.status, 200);

    var afterAcceptedApplications = await request(ctx.app, 'GET', '/api/my-applications', null, applicant.token);
    assert.equal(afterAcceptedApplications.status, 200);
    assert.equal(afterAcceptedApplications.body.applications.length, 0);

    var joinedGroup = await request(ctx.app, 'GET', '/api/groups/' + project.id, null, applicant.token);
    assert.equal(joinedGroup.status, 200);
    assert.equal(joinedGroup.body.group.relation, 'joined');

    var joinedComments = await request(ctx.app, 'GET', '/api/groups/' + project.id + '/comments', null, applicant.token);
    assert.equal(joinedComments.status, 200);

    var left = await request(ctx.app, 'DELETE', '/api/groups/' + project.id + '/membership', null, applicant.token);
    assert.equal(left.status, 200);

    var afterLeaveGroup = await request(ctx.app, 'GET', '/api/groups/' + project.id, null, applicant.token);
    assert.equal(afterLeaveGroup.status, 200);
    assert.equal(afterLeaveGroup.body.group.relation, 'public');
    assert.equal(afterLeaveGroup.body.group.can_view_private_area, false);

    var publicProject = await request(ctx.app, 'GET', '/api/projects/' + project.id, null, applicant.token);
    assert.equal(publicProject.status, 200);
    assert.equal(publicProject.body.project.current_members, 1);
  } finally {
    await ctx.cleanup();
  }
});

test('project comments API only allows group members to list and create comments', async function() {
  var ctx = createContext();
  try {
    var owner = await register(ctx.app, '03');
    var member = await register(ctx.app, '04');
    var outsider = await register(ctx.app, '05');
    var project = await createProject(ctx.app, owner.token);
    await acceptMember(ctx.app, project.id, owner.token, member.token);

    var anonymousList = await request(ctx.app, 'GET', '/api/projects/' + project.id + '/comments');
    assert.equal(anonymousList.status, 401);

    var outsiderList = await request(ctx.app, 'GET', '/api/projects/' + project.id + '/comments', null, outsider.token);
    assert.equal(outsiderList.status, 404);

    var outsiderGroup = await request(ctx.app, 'GET', '/api/groups/' + project.id, null, outsider.token);
    assert.equal(outsiderGroup.status, 200);
    assert.equal(outsiderGroup.body.group.relation, 'public');
    assert.equal(outsiderGroup.body.group.can_view_private_area, false);

    var outsiderMembers = await request(ctx.app, 'GET', '/api/groups/' + project.id + '/members', null, outsider.token);
    assert.equal(outsiderMembers.status, 200);
    assert.deepEqual(outsiderMembers.body.members.map(function(item) {
      return item.group_role;
    }), ['leader', 'member']);

    var outsiderCreated = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/comments', {
      content: 'I should not see this group discussion'
    }, outsider.token);
    assert.equal(outsiderCreated.status, 404);

    var ownerCreated = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/comments', {
      content: 'Owner-only group discussion'
    }, owner.token);
    assert.equal(ownerCreated.status, 201);

    var memberList = await request(ctx.app, 'GET', '/api/projects/' + project.id + '/comments', null, member.token);
    assert.equal(memberList.status, 200);
    assert.deepEqual(memberList.body.comments.map(function(comment) {
      return comment.content;
    }), ['Owner-only group discussion']);
  } finally {
    await ctx.cleanup();
  }
});
