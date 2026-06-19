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
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamup-admin-reports-'));
  var previousDbPath = process.env.TEAMUP_DB_PATH;
  var previousJwtSecret = process.env.JWT_SECRET;
  process.env.TEAMUP_DB_PATH = path.join(tempDir, 'test.sqlite');
  process.env.JWT_SECRET = 'admin-reports-test-secret';
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
    name: 'Report User ' + suffix,
    student_id: 'D96666' + suffix,
    email: 'report-user-' + suffix + '@example.com',
    password: 'abc123'
  });
  assert.equal(response.status, 201);
  return response.body;
}

async function loginSuperAdmin(app) {
  var response = await request(app, 'POST', '/api/login', {
    email: 'admin@gmail.com',
    password: 'admin2006'
  });
  assert.equal(response.status, 200);
  return response.body;
}

async function createProject(app, token) {
  var response = await request(app, 'POST', '/api/projects', {
    title: 'Reported Project',
    description: 'Project being reported',
    max_members: 5
  }, token);
  assert.equal(response.status, 201);
  return response.body.project;
}

test('users submit reports and only admins can list pending reports', async function() {
  var ctx = createContext();
  try {
    var reporter = await register(ctx.app, '01');
    var target = await register(ctx.app, '02');
    var project = await createProject(ctx.app, target.token);
    var admin = await loginSuperAdmin(ctx.app);

    var created = await request(ctx.app, 'POST', '/api/reports', {
      target_user_id: target.user.id,
      target_project_id: project.id,
      reason: '不當內容',
      detail: '專題內容疑似違規'
    }, reporter.token);

    assert.equal(created.status, 201);
    assert.equal(created.body.report.status, 'pending');

    var denied = await request(ctx.app, 'GET', '/api/admin/reports', null, reporter.token);
    assert.equal(denied.status, 403);

    var listed = await request(ctx.app, 'GET', '/api/admin/reports?status=pending', null, admin.token);
    assert.equal(listed.status, 200);
    assert.equal(listed.body.reports.length, 1);
    assert.equal(listed.body.reports[0].reason, '不當內容');
    assert.equal(listed.body.reports[0].reporter_id, reporter.user.id);
    assert.equal(listed.body.reports[0].target_user_id, target.user.id);
    assert.equal(listed.body.reports[0].project_title, 'Reported Project');
  } finally {
    await ctx.cleanup();
  }
});

test('admins ignore and warn reports while users can read and dismiss warnings', async function() {
  var ctx = createContext();
  try {
    var reporter = await register(ctx.app, '03');
    var target = await register(ctx.app, '04');
    var project = await createProject(ctx.app, target.token);
    var admin = await loginSuperAdmin(ctx.app);

    var ignoredReport = await request(ctx.app, 'POST', '/api/reports', {
      target_user_id: target.user.id,
      target_project_id: project.id,
      reason: '重複檢舉'
    }, reporter.token);
    assert.equal(ignoredReport.status, 201);

    var ignored = await request(ctx.app, 'PATCH', '/api/admin/reports/' + ignoredReport.body.report.id + '/ignore', {
      note: '已確認無需處理'
    }, admin.token);
    assert.equal(ignored.status, 200);
    assert.equal(ignored.body.report.status, 'ignored');
    assert.equal(ignored.body.report.handled_action, 'ignore');

    var warnedReport = await request(ctx.app, 'POST', '/api/reports', {
      target_user_id: target.user.id,
      target_project_id: project.id,
      reason: '言語不當'
    }, reporter.token);
    assert.equal(warnedReport.status, 201);

    var warned = await request(ctx.app, 'PATCH', '/api/admin/reports/' + warnedReport.body.report.id + '/warn', {
      message: '請注意留言禮貌'
    }, admin.token);
    assert.equal(warned.status, 200);
    assert.equal(warned.body.report.status, 'handled');
    assert.equal(warned.body.report.handled_action, 'warning');

    var warnings = await request(ctx.app, 'GET', '/api/me/warnings', null, target.token);
    assert.equal(warnings.status, 200);
    assert.equal(warnings.body.warnings.length, 1);
    assert.equal(warnings.body.warnings[0].message, '請注意留言禮貌');

    var dismissed = await request(ctx.app, 'DELETE', '/api/me/warnings/' + warnings.body.warnings[0].id, null, target.token);
    assert.equal(dismissed.status, 200);

    var emptyWarnings = await request(ctx.app, 'GET', '/api/me/warnings', null, target.token);
    assert.equal(emptyWarnings.body.warnings.length, 0);
  } finally {
    await ctx.cleanup();
  }
});

test('admins can ban reported users but cannot ban the super admin', async function() {
  var ctx = createContext();
  try {
    var reporter = await register(ctx.app, '05');
    var target = await register(ctx.app, '06');
    var admin = await loginSuperAdmin(ctx.app);

    var report = await request(ctx.app, 'POST', '/api/reports', {
      target_user_id: target.user.id,
      reason: '嚴重違規'
    }, reporter.token);
    assert.equal(report.status, 201);

    var banned = await request(ctx.app, 'PATCH', '/api/admin/reports/' + report.body.report.id + '/ban', {
      ban_days: 7,
      reason: '違規停權 7 天'
    }, admin.token);
    assert.equal(banned.status, 200);
    assert.equal(banned.body.report.handled_action, 'temporary_ban');

    var targetLogin = await request(ctx.app, 'POST', '/api/login', {
      email: target.user.email,
      password: 'abc123'
    });
    assert.equal(targetLogin.status, 403);

    var superAdmin = await ctx.db.get('SELECT student_id FROM users WHERE role = "super_admin"');
    var superReport = await request(ctx.app, 'POST', '/api/reports', {
      target_user_id: superAdmin.student_id,
      reason: '測試禁止停權 super admin'
    }, reporter.token);
    assert.equal(superReport.status, 201);

    var denied = await request(ctx.app, 'PATCH', '/api/admin/reports/' + superReport.body.report.id + '/ban', {
      ban_days: null,
      reason: '不應成功'
    }, admin.token);
    assert.equal(denied.status, 400);
  } finally {
    await ctx.cleanup();
  }
});

test('admins can search users and manage project teams', async function() {
  var ctx = createContext();
  try {
    var owner = await register(ctx.app, '07');
    var member = await register(ctx.app, '08');
    var invited = await register(ctx.app, '09');
    var nextOwner = await register(ctx.app, '10');
    var admin = await loginSuperAdmin(ctx.app);
    var project = await createProject(ctx.app, owner.token);

    await request(ctx.app, 'POST', '/api/projects/' + project.id + '/apply', {
      message: 'Please accept me'
    }, member.token);

    var pending = await request(ctx.app, 'GET', '/api/projects/' + project.id + '/applications', null, admin.token);
    assert.equal(pending.status, 200);
    assert.equal(pending.body.applications.length, 1);

    var accepted = await request(ctx.app, 'PUT', '/api/applications/' + pending.body.applications[0].id, {
      status: 'accepted'
    }, admin.token);
    assert.equal(accepted.status, 200);

    var adminInvite = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/invitations', {
      user_id: invited.user.id
    }, admin.token);
    assert.equal(adminInvite.status, 201);

    await request(ctx.app, 'POST', '/api/invitations/' + adminInvite.body.invitation.id + '/accept', null, invited.token);

    var nextOwnerInvite = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/invitations', {
      user_id: nextOwner.user.id
    }, admin.token);
    assert.equal(nextOwnerInvite.status, 201);
    await request(ctx.app, 'POST', '/api/invitations/' + nextOwnerInvite.body.invitation.id + '/accept', null, nextOwner.token);

    var transferred = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/transfer-owner', {
      user_id: nextOwner.user.id
    }, admin.token);
    assert.equal(transferred.status, 200);
    assert.equal(transferred.body.project.owner_id, nextOwner.user.id);

    var members = await request(ctx.app, 'GET', '/api/groups/' + project.id + '/members', null, admin.token);
    assert.equal(members.status, 200);
    assert.ok(members.body.members.length >= 4);

    var removed = await request(ctx.app, 'DELETE', '/api/groups/' + project.id + '/members/' + invited.user.id, null, admin.token);
    assert.equal(removed.status, 200);

    var foundByStudentId = await request(ctx.app, 'GET', '/api/admin/users?q=' + encodeURIComponent(member.user.id), null, admin.token);
    assert.equal(foundByStudentId.status, 200);
    assert.equal(foundByStudentId.body.users.length, 1);
    assert.equal(foundByStudentId.body.users[0].student_id, member.user.id);

    var foundByEmail = await request(ctx.app, 'GET', '/api/admin/users?q=' + encodeURIComponent(nextOwner.user.email), null, admin.token);
    assert.equal(foundByEmail.status, 200);
    assert.equal(foundByEmail.body.users.length, 1);
    assert.equal(foundByEmail.body.users[0].email, nextOwner.user.email);
  } finally {
    await ctx.cleanup();
  }
});

test('admins can delete user accounts and project member counts are repaired', async function() {
  var ctx = createContext();
  try {
    var owner = await register(ctx.app, '11');
    var member = await register(ctx.app, '12');
    var admin = await loginSuperAdmin(ctx.app);
    var project = await createProject(ctx.app, owner.token);

    await request(ctx.app, 'POST', '/api/projects/' + project.id + '/apply', {
      message: 'Please accept me'
    }, member.token);
    var pending = await request(ctx.app, 'GET', '/api/projects/' + project.id + '/applications', null, admin.token);
    assert.equal(pending.status, 200);
    assert.equal(pending.body.applications.length, 1);
    var accepted = await request(ctx.app, 'PUT', '/api/applications/' + pending.body.applications[0].id, {
      status: 'accepted'
    }, admin.token);
    assert.equal(accepted.status, 200);

    var beforeDelete = await request(ctx.app, 'GET', '/api/projects/' + project.id, null, admin.token);
    assert.equal(beforeDelete.body.project.current_members, 2);

    var deleted = await request(ctx.app, 'DELETE', '/api/admin/users/' + member.user.id, null, admin.token);
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.deleted_user_id, member.user.id);

    var deletedUser = await ctx.db.get('SELECT student_id FROM users WHERE student_id = ?', [member.user.id]);
    assert.equal(deletedUser, undefined);

    var afterDelete = await request(ctx.app, 'GET', '/api/projects/' + project.id, null, admin.token);
    assert.equal(afterDelete.body.project.current_members, 1);

    var denied = await request(ctx.app, 'DELETE', '/api/admin/users/ADMIN2006', null, admin.token);
    assert.equal(denied.status, 400);
  } finally {
    await ctx.cleanup();
  }
});
