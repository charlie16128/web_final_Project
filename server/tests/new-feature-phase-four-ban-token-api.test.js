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
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamup-phase-four-ban-'));
  var previousDbPath = process.env.TEAMUP_DB_PATH;
  var previousJwtSecret = process.env.JWT_SECRET;
  process.env.TEAMUP_DB_PATH = path.join(tempDir, 'test.sqlite');
  process.env.JWT_SECRET = 'phase-four-ban-test-secret';
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
    student_id: 'D73333' + suffix,
    email: 'phase-four-ban-' + suffix + '@example.com',
    password: 'abc123'
  });
  assert.equal(response.status, 201);
  return response.body;
}

async function loginAdmin(app) {
  var response = await request(app, 'POST', '/api/login', {
    email: 'admin@gmail.com',
    password: 'admin2006'
  });
  assert.equal(response.status, 200);
  return response.body;
}

test('admin bans invalidate existing tokens and store second-level duration', async function() {
  var ctx = createContext();
  try {
    var admin = await loginAdmin(ctx.app);
    var target = await register(ctx.app, '01');
    var before = await ctx.db.get('SELECT token_version FROM users WHERE student_id = ?', [target.user.id]);
    assert.equal(before.token_version, 0);

    var startedAt = Date.now();
    var banned = await request(ctx.app, 'POST', '/api/admin/users/' + target.user.id + '/ban', {
      reason: 'Phase 4 token invalidation',
      days: 0,
      hours: 0,
      minutes: 10,
      seconds: 5
    }, admin.token);
    assert.equal(banned.status, 200);
    assert.equal(banned.body.user.is_suspended, 1);
    assert.equal(banned.body.user.token_version, 1);

    var row = await ctx.db.get(
      'SELECT is_suspended, suspended_until, banned_until, token_version FROM users WHERE student_id = ?',
      [target.user.id]
    );
    assert.equal(row.is_suspended, 1);
    assert.equal(row.token_version, 1);
    assert.equal(row.suspended_until, row.banned_until);

    var durationMs = new Date(row.suspended_until).getTime() - startedAt;
    assert.ok(durationMs >= 604000, 'duration should be at least 10 minutes and 4 seconds');
    assert.ok(durationMs <= 607000, 'duration should be close to 10 minutes and 5 seconds');

    var staleToken = await request(ctx.app, 'GET', '/api/users/me', null, target.token);
    assert.equal(staleToken.status, 401);
    assert.match(staleToken.body.message, /登入已失效|封鎖|停權/);

    var deniedLogin = await request(ctx.app, 'POST', '/api/login', {
      email: target.user.email,
      password: 'abc123'
    });
    assert.equal(deniedLogin.status, 403);
    assert.equal(deniedLogin.body.banned_until, row.suspended_until);
  } finally {
    await ctx.cleanup();
  }
});

test('ban duration rejects negative values and out-of-range time parts', async function() {
  var ctx = createContext();
  try {
    var admin = await loginAdmin(ctx.app);
    var target = await register(ctx.app, '02');

    var negative = await request(ctx.app, 'POST', '/api/admin/users/' + target.user.id + '/ban', {
      reason: 'Invalid duration',
      days: 0,
      hours: -1,
      minutes: 0,
      seconds: 0
    }, admin.token);
    assert.equal(negative.status, 400);

    var invalidMinute = await request(ctx.app, 'POST', '/api/admin/users/' + target.user.id + '/ban', {
      reason: 'Invalid duration',
      days: 0,
      hours: 0,
      minutes: 60,
      seconds: 0
    }, admin.token);
    assert.equal(invalidMinute.status, 400);
  } finally {
    await ctx.cleanup();
  }
});
