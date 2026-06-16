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
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamup-settings-'));
  var previousDbPath = process.env.TEAMUP_DB_PATH;
  var previousJwtSecret = process.env.JWT_SECRET;
  process.env.TEAMUP_DB_PATH = path.join(tempDir, 'test.sqlite');
  process.env.JWT_SECRET = 'settings-test-secret';
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
    name: '測試使用者' + suffix,
    student_id: 'D12345' + suffix,
    email: 'user' + suffix + '@example.com',
    password: 'abc123'
  });
  assert.equal(response.status, 201);
  return response.body;
}

test('database test context uses TEAMUP_DB_PATH and can close cleanly', async function() {
  var ctx = createContext();
  try {
    var columns = await ctx.db.all('PRAGMA table_info(users)');
    assert.equal(fs.existsSync(process.env.TEAMUP_DB_PATH), true);
    assert.equal(columns.some(function(column) {
      return column.name === 'email';
    }), true);
  } finally {
    await ctx.cleanup();
  }
});

test('user settings update email and password while keeping name and student ID read-only', async function() {
  var ctx = createContext();
  try {
    var created = await register(ctx.app, '01');

    var updated = await request(ctx.app, 'PUT', '/api/users/me', {
      name: '不應更新',
      student_id: 'D9999999',
      email: 'new-email@example.com',
      password: 'def456'
    }, created.token);

    assert.equal(updated.status, 200);
    assert.equal(updated.body.user.name, '測試使用者01');
    assert.equal(updated.body.user.student_id, 'D1234501');
    assert.equal(updated.body.user.email, 'new-email@example.com');

    var oldLogin = await request(ctx.app, 'POST', '/api/login', {
      email: 'user01@example.com',
      password: 'abc123'
    });
    assert.equal(oldLogin.status, 401);

    var newLogin = await request(ctx.app, 'POST', '/api/login', {
      email: 'new-email@example.com',
      password: 'def456'
    });
    assert.equal(newLogin.status, 200);
    assert.equal(newLogin.body.user.name, '測試使用者01');
    assert.equal(newLogin.body.user.student_id, 'D1234501');
  } finally {
    await ctx.cleanup();
  }
});

test('user settings reject duplicate email and weak password', async function() {
  var ctx = createContext();
  try {
    var first = await register(ctx.app, '02');
    await register(ctx.app, '03');

    var duplicateEmail = await request(ctx.app, 'PUT', '/api/users/me', {
      email: 'user03@example.com',
      password: ''
    }, first.token);
    assert.equal(duplicateEmail.status, 409);

    var weakPassword = await request(ctx.app, 'PUT', '/api/users/me', {
      email: 'first-new@example.com',
      password: '123'
    }, first.token);
    assert.equal(weakPassword.status, 400);
  } finally {
    await ctx.cleanup();
  }
});

test('user settings reject stale token instead of server error', async function() {
  var ctx = createContext();
  try {
    var auth = require('../middleware/auth');
    var staleToken = auth.signToken({
      student_id: 'D9999999',
      email: 'missing-user@example.com'
    });

    var response = await request(ctx.app, 'PUT', '/api/users/me', {
      email: 'new-missing-user@example.com',
      password: ''
    }, staleToken);

    assert.equal(response.status, 401);
    assert.equal(response.body.message, '登入狀態已失效，請重新登入');
  } finally {
    await ctx.cleanup();
  }
});
