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
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamup-phase-three-'));
  var previousDbPath = process.env.TEAMUP_DB_PATH;
  var previousJwtSecret = process.env.JWT_SECRET;
  process.env.TEAMUP_DB_PATH = path.join(tempDir, 'test.sqlite');
  process.env.JWT_SECRET = 'phase-three-test-secret';
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
    name: 'Phase Three User ' + suffix,
    student_id: 'D73345' + suffix,
    email: 'phase-three-' + suffix + '@example.com',
    password: 'abc123'
  });
  assert.equal(response.status, 201);
  return response.body;
}

async function createProject(app, token) {
  var response = await request(app, 'POST', '/api/projects', {
    title: 'Phase Three Project',
    description: 'Project details test',
    max_members: 4,
    accepting_applications: true
  }, token);
  assert.equal(response.status, 201);
  return response.body.project;
}

async function acceptMember(app, projectId, ownerToken, memberToken) {
  var applied = await request(app, 'POST', '/api/projects/' + projectId + '/apply', {
    message: 'Please add me'
  }, memberToken);
  assert.equal(applied.status, 201);

  var accepted = await request(app, 'PUT', '/api/applications/' + applied.body.application.id, {
    status: 'accepted'
  }, ownerToken);
  assert.equal(accepted.status, 200);
}

test('project owners manage announcements while members can only read them', async function() {
  var ctx = createContext();
  try {
    var owner = await register(ctx.app, '01');
    var member = await register(ctx.app, '02');
    var project = await createProject(ctx.app, owner.token);
    await acceptMember(ctx.app, project.id, owner.token, member.token);

    var created = await request(ctx.app, 'POST', '/api/groups/' + project.id + '/announcements', {
      content: 'Tonight at 8 we will split the final report sections.'
    }, owner.token);
    assert.equal(created.status, 201);
    assert.equal(created.body.announcement.content, 'Tonight at 8 we will split the final report sections.');
    assert.equal(created.body.announcement.author_name, 'Phase Three User 01');

    var memberList = await request(ctx.app, 'GET', '/api/groups/' + project.id + '/announcements', null, member.token);
    assert.equal(memberList.status, 200);
    assert.equal(memberList.body.announcements.length, 1);

    var rejected = await request(ctx.app, 'POST', '/api/groups/' + project.id + '/announcements', {
      content: 'Member should not be able to edit announcements'
    }, member.token);
    assert.equal(rejected.status, 403);

    var updated = await request(ctx.app, 'PUT', '/api/groups/' + project.id + '/announcements/' + created.body.announcement.id, {
      content: 'Updated announcement content'
    }, owner.token);
    assert.equal(updated.status, 200);
    assert.equal(updated.body.announcement.content, 'Updated announcement content');

    var deleted = await request(ctx.app, 'DELETE', '/api/groups/' + project.id + '/announcements/' + created.body.announcement.id, null, owner.token);
    assert.equal(deleted.status, 200);

    var afterDelete = await request(ctx.app, 'GET', '/api/groups/' + project.id + '/announcements', null, owner.token);
    assert.equal(afterDelete.status, 200);
    assert.equal(afterDelete.body.announcements.length, 0);
  } finally {
    await ctx.cleanup();
  }
});

test('announcement timestamps are returned as parseable UTC instants for Taipei display', async function() {
  var ctx = createContext();
  try {
    var owner = await register(ctx.app, '13');
    var project = await createProject(ctx.app, owner.token);

    var created = await request(ctx.app, 'POST', '/api/groups/' + project.id + '/announcements', {
      content: 'Timestamp should render in Taipei time.'
    }, owner.token);
    assert.equal(created.status, 201);
    assert.match(created.body.announcement.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.ok(Number.isFinite(new Date(created.body.announcement.created_at).getTime()));

    var listed = await request(ctx.app, 'GET', '/api/groups/' + project.id + '/announcements', null, owner.token);
    assert.equal(listed.status, 200);
    assert.match(listed.body.announcements[0].created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    var updated = await request(ctx.app, 'PUT', '/api/groups/' + project.id + '/announcements/' + created.body.announcement.id, {
      content: 'Updated timestamp should render in Taipei time.'
    }, owner.token);
    assert.equal(updated.status, 200);
    assert.match(updated.body.announcement.updated_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.ok(Number.isFinite(new Date(updated.body.announcement.updated_at).getTime()));
  } finally {
    await ctx.cleanup();
  }
});
test('project owners manage deadlines and lists are ordered by nearest date', async function() {
  var ctx = createContext();
  try {
    var owner = await register(ctx.app, '03');
    var member = await register(ctx.app, '04');
    var project = await createProject(ctx.app, owner.token);
    await acceptMember(ctx.app, project.id, owner.token, member.token);

    var later = await request(ctx.app, 'POST', '/api/groups/' + project.id + '/deadlines', {
      title: 'Final slides',
      deadline_date: '2099-02-01',
      description: 'Upload the slide deck'
    }, owner.token);
    assert.equal(later.status, 201);

    var earlier = await request(ctx.app, 'POST', '/api/groups/' + project.id + '/deadlines', {
      title: 'Final report',
      deadline_date: '2099-01-15',
      description: 'Submit the written report'
    }, owner.token);
    assert.equal(earlier.status, 201);

    var listed = await request(ctx.app, 'GET', '/api/groups/' + project.id + '/deadlines', null, member.token);
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body.deadlines.map(function(deadline) {
      return deadline.title;
    }), ['Final report', 'Final slides']);

    var rejected = await request(ctx.app, 'POST', '/api/groups/' + project.id + '/deadlines', {
      title: 'Member deadline',
      deadline_date: '2099-03-01'
    }, member.token);
    assert.equal(rejected.status, 403);

    var updated = await request(ctx.app, 'PUT', '/api/groups/' + project.id + '/deadlines/' + earlier.body.deadline.id, {
      title: 'Final written report',
      deadline_date: '2099-01-20',
      description: 'Updated deadline'
    }, owner.token);
    assert.equal(updated.status, 200);
    assert.equal(updated.body.deadline.title, 'Final written report');

    var deleted = await request(ctx.app, 'DELETE', '/api/groups/' + project.id + '/deadlines/' + later.body.deadline.id, null, owner.token);
    assert.equal(deleted.status, 200);
  } finally {
    await ctx.cleanup();
  }
});
