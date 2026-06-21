var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var http = require('node:http');
var os = require('node:os');
var path = require('node:path');

function clientPath(filePath) {
  return path.join(__dirname, '..', '..', 'client', filePath);
}

function readClient(filePath) {
  return fs.readFileSync(clientPath(filePath), 'utf8');
}

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
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamup-admin-stage-seven-'));
  var previousDbPath = process.env.TEAMUP_DB_PATH;
  var previousJwtSecret = process.env.JWT_SECRET;
  process.env.TEAMUP_DB_PATH = path.join(tempDir, 'test.sqlite');
  process.env.JWT_SECRET = 'admin-stage-seven-test-secret';
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
    name: 'Admin Stats User ' + suffix,
    student_id: 'D97777' + suffix,
    email: 'admin-stats-user-' + suffix + '@example.com',
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

test('admin stats endpoint returns dashboard counts for admins only', async function() {
  var ctx = createContext();
  try {
    var reporter = await register(ctx.app, '01');
    var target = await register(ctx.app, '02');
    var admin = await loginSuperAdmin(ctx.app);

    var project = await request(ctx.app, 'POST', '/api/projects', {
      title: 'Today Admin Stats Project',
      description: 'Created today',
      max_members: 4
    }, target.token);
    assert.equal(project.status, 201);

    var report = await request(ctx.app, 'POST', '/api/reports', {
      target_user_id: target.user.id,
      target_project_id: project.body.project.id,
      reason: 'stats report'
    }, reporter.token);
    assert.equal(report.status, 201);

    var banned = await request(ctx.app, 'POST', '/api/admin/users/' + target.user.id + '/ban', {
      reason: 'stats ban',
      minutes: 1
    }, admin.token);
    assert.equal(banned.status, 200);

    var denied = await request(ctx.app, 'GET', '/api/admin/stats', null, reporter.token);
    assert.equal(denied.status, 403);

    var stats = await request(ctx.app, 'GET', '/api/admin/stats', null, admin.token);
    assert.equal(stats.status, 200);
    assert.deepEqual(Object.keys(stats.body.stats).sort(), [
      'banned_users',
      'pending_reports',
      'today_projects',
      'total_users'
    ]);
    assert.equal(stats.body.stats.pending_reports, 1);
    assert.equal(stats.body.stats.today_projects, 1);
    assert.equal(stats.body.stats.banned_users, 1);
    assert.equal(stats.body.stats.total_users, 3);
  } finally {
    await ctx.cleanup();
  }
});

test('admin optimization UI loads and renders dashboard stats', function() {
  var adminView = readClient('src/views/AdminView.vue');
  var homeView = readClient('src/views/HomeView.vue');
  var style = readClient('src/assets/style.css');

  assert.match(adminView, /const stats = reactive\(\{/);
  assert.match(adminView, /pending_reports:\s*0/);
  assert.match(adminView, /today_projects:\s*0/);
  assert.match(adminView, /banned_users:\s*0/);
  assert.match(adminView, /total_users:\s*0/);
  assert.match(adminView, /api\.get\('\/admin\/stats'\)/);
  assert.match(adminView, /class="admin-stats"/);
  assert.match(adminView, /stats\.pending_reports/);
  assert.match(adminView, /stats\.today_projects/);
  assert.match(adminView, /stats\.banned_users/);
  assert.match(adminView, /stats\.total_users/);
  assert.match(adminView, /loadStats\(\)/);

  assert.match(homeView, /class="admin-entry-icon"/);
  assert.match(homeView, /<strong>[\s\S]*<\/strong>/);
  assert.match(homeView, /<small>[\s\S]*<\/small>/);

  assert.match(style, /\.admin-stats/);
  assert.match(style, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(style, /\.admin-entry-icon/);
  assert.match(style, /@media \(max-width: 900px\)[\s\S]*\.admin-stats/);
  assert.match(style, /@media \(max-width: 560px\)[\s\S]*\.admin-stats/);

  assert.ok(adminView.includes('aria-label="\u7ba1\u7406\u7d71\u8a08"'));
  assert.ok(adminView.includes('>\u5f85\u8655\u7406\u6aa2\u8209<'));
  assert.ok(adminView.includes('>\u4eca\u65e5\u65b0\u589e\u968a\u4f0d<'));
  assert.ok(adminView.includes('>\u505c\u6b0a\u6703\u54e1<'));
  assert.ok(adminView.includes('>\u6703\u54e1\u7e3d\u6578<'));
  assert.ok(homeView.includes('>\u7ba1\u7406\u54e1\u5c08\u7528\u4ecb\u9762<'));
  assert.ok(homeView.includes('>\u67e5\u770b\u6aa2\u8209\u3001\u6703\u54e1\u72c0\u614b\u8207\u5e73\u53f0\u7d71\u8a08<'));
});
