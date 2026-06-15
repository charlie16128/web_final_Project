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
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamup-admin-'));
  var previousDbPath = process.env.TEAMUP_DB_PATH;
  var previousJwtSecret = process.env.JWT_SECRET;
  process.env.TEAMUP_DB_PATH = path.join(tempDir, 'test.sqlite');
  process.env.JWT_SECRET = 'admin-phase-test-secret';
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

test('seeds admin2006 as the super admin account and allows login', async function() {
  var ctx = createContext();
  try {
    var row = await ctx.db.get('SELECT username, email, role, is_suspended FROM users WHERE email = ?', [
      'admin@gmail.com'
    ]);
    assert.equal(row.username, 'admin2006');
    assert.equal(row.role, 'super_admin');
    assert.equal(row.is_suspended, 0);

    var login = await request(ctx.app, 'POST', '/api/login', {
      email: 'admin@gmail.com',
      password: 'admin2006'
    });

    assert.equal(login.status, 200);
    assert.equal(login.body.user.username, 'admin2006');
    assert.equal(login.body.user.name, 'admin2006');
    assert.equal(login.body.user.role, 'super_admin');
  } finally {
    await ctx.cleanup();
  }
});

test('registered users default to role user and expose username', async function() {
  var ctx = createContext();
  try {
    var registered = await request(ctx.app, 'POST', '/api/register', {
      name: 'Normal User',
      student_id: 'D7654321',
      email: 'normal@example.com',
      password: 'abc123'
    });

    assert.equal(registered.status, 201);
    assert.equal(registered.body.user.username, 'Normal User');
    assert.equal(registered.body.user.role, 'user');

    var me = await request(ctx.app, 'GET', '/api/users/me', null, registered.body.token);
    assert.equal(me.status, 200);
    assert.equal(me.body.user.username, 'Normal User');
    assert.equal(me.body.user.role, 'user');
  } finally {
    await ctx.cleanup();
  }
});
