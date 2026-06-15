var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var http = require('node:http');
var os = require('node:os');
var path = require('node:path');

function clearModules() {
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

function request(app, url) {
  return new Promise(function(resolve, reject) {
    var server = app.listen(0, function() {
      var req = http.request({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: url,
        method: 'GET'
      }, function(res) {
        var text = '';
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
          text += chunk;
        });
        res.on('end', function() {
          server.close(function() {
            var body = text;
            try {
              body = JSON.parse(text);
            } catch (err) {
              body = text;
            }
            resolve({
              status: res.statusCode,
              contentType: res.headers['content-type'] || '',
              body: body
            });
          });
        });
      });

      req.on('error', function(err) {
        server.close(function() {
          reject(err);
        });
      });
      req.end();
    });
  });
}

test('root package exposes Azure build and start scripts', function() {
  var rootPackage = require('../../package.json');

  assert.equal(rootPackage.scripts.build, 'npm run build --prefix client');
  assert.equal(rootPackage.scripts.start, 'npm start --prefix server');
  assert.equal(rootPackage.scripts.postinstall, undefined);
});

test('all packages target Node.js 24 for Azure and GitHub Actions', function() {
  var rootPackage = require('../../package.json');
  var clientPackage = require('../../client/package.json');
  var serverPackage = require('../package.json');

  assert.match(rootPackage.version, /^\d+\.\d+\.\d+$/);
  assert.equal(rootPackage.engines.node, '24.x');
  assert.equal(clientPackage.engines.node, '24.x');
  assert.equal(serverPackage.engines.node, '24.x');
});

test('production mode requires JWT_SECRET', function() {
  var previousNodeEnv = process.env.NODE_ENV;
  var previousJwtSecret = process.env.JWT_SECRET;
  process.env.NODE_ENV = 'production';
  delete process.env.JWT_SECRET;
  clearModules();

  try {
    assert.throws(function() {
      require('../middleware/auth');
    }, /JWT_SECRET/);
  } finally {
    clearModules();
    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('JWT_SECRET', previousJwtSecret);
  }
});

test('database creates TEAMUP_DB_PATH parent directory', async function() {
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamup-azure-db-'));
  var dbPath = path.join(tempDir, 'nested', 'teamup.sqlite');
  var previousDbPath = process.env.TEAMUP_DB_PATH;
  process.env.TEAMUP_DB_PATH = dbPath;
  clearModules();

  var db = require('../database/db');
  try {
    await db.run('INSERT INTO users (name, student_id, email, password) VALUES (?, ?, ?, ?)', [
      'Azure Test',
      'AZURE001',
      'azure@example.com',
      'secret'
    ]);

    assert.equal(fs.existsSync(path.dirname(dbPath)), true);
    assert.equal(fs.existsSync(dbPath), true);
  } finally {
    await db.close();
    clearModules();
    restoreEnv('TEAMUP_DB_PATH', previousDbPath);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('spa route returns deployment hint when client build is missing', async function() {
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamup-missing-client-'));
  var previousClientDistPath = process.env.TEAMUP_CLIENT_DIST_PATH;
  var previousJwtSecret = process.env.JWT_SECRET;
  process.env.TEAMUP_CLIENT_DIST_PATH = path.join(tempDir, 'dist');
  process.env.JWT_SECRET = 'deployment-test-secret';
  clearModules();

  try {
    var app = require('../app');
    var response = await request(app, '/projects/123');

    assert.equal(response.status, 503);
    assert.match(response.contentType, /application\/json/);
    assert.match(response.body.message, /npm run build/);
  } finally {
    clearModules();
    restoreEnv('TEAMUP_CLIENT_DIST_PATH', previousClientDistPath);
    restoreEnv('JWT_SECRET', previousJwtSecret);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
