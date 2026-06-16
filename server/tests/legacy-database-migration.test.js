var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var http = require('node:http');
var os = require('node:os');
var path = require('node:path');
var sqlite3 = require('sqlite3').verbose();
var bcrypt = require('bcrypt');

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

function runSql(db, sql, params) {
  return new Promise(function(resolve, reject) {
    db.run(sql, params || [], function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function closeDb(db) {
  return new Promise(function(resolve, reject) {
    db.close(function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

async function createLegacyDatabase(dbPath) {
  var db = new sqlite3.Database(dbPath);
  var hash = await bcrypt.hash('abc123', 10);

  await runSql(db, 'PRAGMA foreign_keys = ON');
  await runSql(
    db,
    'CREATE TABLE users (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'name TEXT NOT NULL,' +
      'student_id TEXT NOT NULL,' +
      'email TEXT NOT NULL UNIQUE,' +
      'password TEXT NOT NULL,' +
      'role TEXT DEFAULT "user",' +
      'created_at TEXT DEFAULT CURRENT_TIMESTAMP' +
    ')'
  );
  await runSql(
    db,
    'CREATE TABLE projects (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'title TEXT NOT NULL,' +
      'course_name TEXT,' +
      'teacher_name TEXT,' +
      'description TEXT NOT NULL,' +
      'required_skills TEXT,' +
      'current_members INTEGER DEFAULT 1,' +
      'max_members INTEGER NOT NULL,' +
      'status TEXT DEFAULT "open",' +
      'accepting_applications INTEGER DEFAULT 1,' +
      'contact TEXT,' +
      'owner_id INTEGER NOT NULL,' +
      'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
      'FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE' +
    ')'
  );
  await runSql(
    db,
    'INSERT INTO users (id, name, student_id, email, password, role) VALUES (?, ?, ?, ?, ?, ?)',
    [1, 'Legacy User', 'D5555555', 'legacy@example.com', hash, 'user']
  );
  await runSql(
    db,
    'INSERT INTO projects (title, course_name, teacher_name, description, required_skills, current_members, max_members, status, accepting_applications, contact, owner_id) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ['Legacy Project', '', '', 'Existing old-schema project', '', 1, 3, 'open', 1, '', 1]
  );
  await closeDb(db);
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

test('legacy sqlite users.id foreign keys migrate to users.student_id before project creation', async function() {
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamup-legacy-db-'));
  var dbPath = path.join(tempDir, 'legacy.sqlite');
  var previousDbPath = process.env.TEAMUP_DB_PATH;
  var previousJwtSecret = process.env.JWT_SECRET;

  var appDb = null;

  try {
    await createLegacyDatabase(dbPath);

    process.env.TEAMUP_DB_PATH = dbPath;
    process.env.JWT_SECRET = 'legacy-db-test-secret';
    clearAppModules();

    var app = require('../app');
    var db = require('../database/db');
    appDb = db;

    var login = await request(app, 'POST', '/api/login', {
      email: 'legacy@example.com',
      password: 'abc123'
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.student_id, 'D5555555');

    var created = await request(app, 'POST', '/api/projects', {
      title: 'Migrated Project',
      description: 'Created after schema migration',
      max_members: 4
    }, login.body.token);
    assert.equal(created.status, 201);
    assert.equal(created.body.project.owner_id, 'D5555555');

    var ownerForeignKey = await db.all('PRAGMA foreign_key_list(projects)');
    assert.equal(ownerForeignKey[0].table, 'users');
    assert.equal(ownerForeignKey[0].from, 'owner_id');
    assert.equal(ownerForeignKey[0].to, 'student_id');

    var legacyProject = await db.get('SELECT owner_id FROM projects WHERE title = ?', ['Legacy Project']);
    assert.equal(legacyProject.owner_id, 'D5555555');

  } finally {
    if (appDb) {
      await appDb.close().catch(function() {});
    }
    clearAppModules();
    restoreEnv('TEAMUP_DB_PATH', previousDbPath);
    restoreEnv('JWT_SECRET', previousJwtSecret);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
