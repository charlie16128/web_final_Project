var path = require('path');
var fs = require('fs');
var bcrypt = require('bcrypt');
var sqlite3 = require('sqlite3').verbose();

var dbPath = process.env.TEAMUP_DB_PATH || path.join(__dirname, 'teamup.sqlite');
var dbDirectory = path.dirname(dbPath);

if (!fs.existsSync(dbDirectory)) {
  fs.mkdirSync(dbDirectory, { recursive: true });
}

var db = new sqlite3.Database(dbPath);

function addColumn(table, definition) {
  db.run('ALTER TABLE ' + table + ' ADD COLUMN ' + definition, function(err) {
    if (err && err.message.indexOf('duplicate column name') === -1) {
      console.error(err);
    }
  });
}

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

function close() {
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

function init() {
  db.serialize(function() {
    db.run('PRAGMA foreign_keys = ON');
    db.run(
      'CREATE TABLE IF NOT EXISTS users (' +
        'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
        'username TEXT,' +
        'name TEXT NOT NULL,' +
        'student_id TEXT NOT NULL UNIQUE,' +
        'class_name TEXT,' +
        'email TEXT NOT NULL UNIQUE,' +
        'password TEXT NOT NULL,' +
        'role TEXT DEFAULT "user",' +
        'avatar TEXT,' +
        'department TEXT,' +
        'grade TEXT,' +
        'skills TEXT,' +
        'bio TEXT,' +
        'github_url TEXT,' +
        'is_suspended INTEGER DEFAULT 0,' +
        'created_at TEXT DEFAULT CURRENT_TIMESTAMP' +
      ')'
    );
    addColumn('users', 'student_id TEXT');
    addColumn('users', 'username TEXT');
    addColumn('users', 'role TEXT DEFAULT "user"');
    addColumn('users', 'avatar TEXT');
    addColumn('users', 'department TEXT');
    addColumn('users', 'grade TEXT');
    addColumn('users', 'github_url TEXT');
    addColumn('users', 'is_suspended INTEGER DEFAULT 0');
    db.run('UPDATE users SET username = name WHERE username IS NULL OR username = ""');
    db.run('UPDATE users SET role = "user" WHERE role IS NULL OR role = ""');
    db.run('UPDATE users SET is_suspended = 0 WHERE is_suspended IS NULL');
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id) WHERE student_id IS NOT NULL');
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL');
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
    db.run(
      'CREATE TABLE IF NOT EXISTS project_favorites (' +
        'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
        'user_id INTEGER NOT NULL,' +
        'project_id INTEGER NOT NULL,' +
        'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
        'UNIQUE(user_id, project_id),' +
        'FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,' +
        'FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE' +
      ')'
    );
    db.run(
      'CREATE TABLE IF NOT EXISTS project_announcements (' +
        'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
        'project_id INTEGER NOT NULL,' +
        'author_id INTEGER NOT NULL,' +
        'content TEXT NOT NULL,' +
        'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
        'updated_at TEXT,' +
        'FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,' +
        'FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE' +
      ')'
    );
    db.run(
      'CREATE TABLE IF NOT EXISTS project_deadlines (' +
        'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
        'project_id INTEGER NOT NULL,' +
        'title TEXT NOT NULL,' +
        'deadline_date TEXT NOT NULL,' +
        'description TEXT,' +
        'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
        'updated_at TEXT,' +
        'FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE' +
      ')'
    );
    db.run(
      'CREATE TABLE IF NOT EXISTS project_invitations (' +
        'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
        'project_id INTEGER NOT NULL,' +
        'inviter_id INTEGER NOT NULL,' +
        'invitee_id INTEGER NOT NULL,' +
        'message TEXT,' +
        'status TEXT DEFAULT "pending",' +
        'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
        'responded_at TEXT,' +
        'UNIQUE(project_id, invitee_id),' +
        'FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,' +
        'FOREIGN KEY(inviter_id) REFERENCES users(id) ON DELETE CASCADE,' +
        'FOREIGN KEY(invitee_id) REFERENCES users(id) ON DELETE CASCADE' +
      ')'
    );
    db.run(
      'CREATE TABLE IF NOT EXISTS notifications (' +
        'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
        'user_id INTEGER NOT NULL,' +
        'type TEXT NOT NULL,' +
        'title TEXT NOT NULL,' +
        'content TEXT,' +
        'link TEXT,' +
        'is_read INTEGER DEFAULT 0,' +
        'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
        'FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE' +
      ')'
    );
    seedSuperAdmin();
  });
}

init();

function seedSuperAdmin() {
  var hash = bcrypt.hashSync('admin2006', 10);

  db.run(
    'INSERT OR IGNORE INTO users (username, name, student_id, email, password, role, is_suspended) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['admin2006', 'admin2006', 'ADMIN2006', 'admin@gmail.com', hash, 'super_admin', 0]
  );
  db.run(
    'UPDATE users SET username = ?, name = ?, password = ?, role = ?, is_suspended = 0 WHERE email = ?',
    ['admin2006', 'admin2006', hash, 'super_admin', 'admin@gmail.com']
  );
}

module.exports = {
  all: all,
  get: get,
  run: run,
  close: close
};
