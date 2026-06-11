var path = require('path');
var sqlite3 = require('sqlite3').verbose();

var dbPath = path.join(__dirname, 'teamup.sqlite');
var db = new sqlite3.Database(dbPath);

function run(sql, params) {
  return new Promise(function(resolve, reject) {
    db.run(sql, params || [], function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params) {
  return new Promise(function(resolve, reject) {
    db.get(sql, params || [], function(err, row) {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function all(sql, params) {
  return new Promise(function(resolve, reject) {
    db.all(sql, params || [], function(err, rows) {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

function init() {
  db.serialize(function() {
    db.run('PRAGMA foreign_keys = ON');
    db.run(
      'CREATE TABLE IF NOT EXISTS users (' +
        'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
        'name TEXT NOT NULL,' +
        'student_id TEXT NOT NULL UNIQUE,' +
        'class_name TEXT,' +
        'email TEXT NOT NULL UNIQUE,' +
        'password TEXT NOT NULL,' +
        'skills TEXT,' +
        'bio TEXT,' +
        'created_at TEXT DEFAULT CURRENT_TIMESTAMP' +
      ')'
    );
    db.run('ALTER TABLE users ADD COLUMN student_id TEXT', function(err) {
      if (err && err.message.indexOf('duplicate column name') === -1) {
        console.error(err);
      }
    });
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id) WHERE student_id IS NOT NULL');
    db.run(
      'CREATE TABLE IF NOT EXISTS projects (' +
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
    db.run('ALTER TABLE projects ADD COLUMN accepting_applications INTEGER DEFAULT 1', function(err) {
      if (err && err.message.indexOf('duplicate column name') === -1) {
        console.error(err);
      }
    });
    db.run(
      'CREATE TABLE IF NOT EXISTS applications (' +
        'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
        'project_id INTEGER NOT NULL,' +
        'user_id INTEGER NOT NULL,' +
        'message TEXT,' +
        'status TEXT DEFAULT "pending",' +
        'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
        'UNIQUE(project_id, user_id),' +
        'FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,' +
        'FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE' +
      ')'
    );
    db.run(
      'CREATE TABLE IF NOT EXISTS comments (' +
        'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
        'project_id INTEGER NOT NULL,' +
        'user_id INTEGER NOT NULL,' +
        'content TEXT NOT NULL,' +
        'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
        'FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,' +
        'FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE' +
      ')'
    );
    db.run(
      'CREATE TABLE IF NOT EXISTS favorites (' +
        'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
        'project_id INTEGER NOT NULL,' +
        'user_id INTEGER NOT NULL,' +
        'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
        'UNIQUE(project_id, user_id),' +
        'FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,' +
        'FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE' +
      ')'
    );
  });
}

init();

module.exports = {
  all: all,
  get: get,
  run: run
};
