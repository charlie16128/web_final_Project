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

function rawRun(sql, params) {
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

function rawGet(sql, params) {
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

function rawAll(sql, params) {
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

function rawClose() {
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

function run(sql, params) {
  return ready.then(function() {
    return rawRun(sql, params);
  });
}

function get(sql, params) {
  return ready.then(function() {
    return rawGet(sql, params);
  });
}

function all(sql, params) {
  return ready.then(function() {
    return rawAll(sql, params);
  });
}

function close() {
  return ready.then(rawClose);
}

async function addColumn(table, definition) {
  try {
    await rawRun('ALTER TABLE ' + table + ' ADD COLUMN ' + definition);
  } catch (err) {
    if (err.message.indexOf('duplicate column name') === -1) {
      throw err;
    }
  }
}

async function tableExists(table) {
  var row = await rawGet(
    'SELECT name FROM sqlite_master WHERE type = "table" AND name = ?',
    [table]
  );
  return Boolean(row);
}

async function tableColumns(table) {
  if (!(await tableExists(table))) {
    return [];
  }
  return rawAll('PRAGMA table_info(' + table + ')');
}

function hasColumn(columns, name) {
  return columns.some(function(column) {
    return column.name === name;
  });
}

function columnExpr(columns, name, fallback) {
  return hasColumn(columns, name) ? name : fallback;
}

function coalesceColumnExpr(columns, name, fallback) {
  return hasColumn(columns, name) ? 'COALESCE(' + name + ', ' + fallback + ')' : fallback;
}

function legacyUserReferenceExpr(columns, name) {
  if (!hasColumn(columns, name)) {
    return 'NULL';
  }
  return 'COALESCE((SELECT student_id FROM users_legacy_migration WHERE users_legacy_migration.id = CAST(' +
    name +
    ' AS INTEGER)), ' +
    name +
    ')';
}

async function userForeignKeyTargetsLegacyId(table) {
  if (!(await tableExists(table))) {
    return false;
  }
  var foreignKeys = await rawAll('PRAGMA foreign_key_list(' + table + ')');
  return foreignKeys.some(function(foreignKey) {
    return foreignKey.table === 'users' && foreignKey.to === 'id';
  });
}

async function prepareLegacyMigration() {
  var userColumns = await tableColumns('users');
  if (!userColumns.length) {
    return null;
  }

  var legacyUserPrimaryKey = userColumns.some(function(column) {
    return column.name === 'id' && column.pk === 1;
  });
  var userForeignKeyTables = [
    'projects',
    'applications',
    'comments',
    'favorites',
    'project_favorites',
    'project_announcements',
    'project_invitations',
    'notifications'
  ];
  var legacyForeignKey = false;

  for (var i = 0; i < userForeignKeyTables.length; i += 1) {
    if (await userForeignKeyTargetsLegacyId(userForeignKeyTables[i])) {
      legacyForeignKey = true;
    }
  }

  if (!legacyUserPrimaryKey && !legacyForeignKey) {
    return null;
  }

  var tables = [
    'users',
    'projects',
    'applications',
    'comments',
    'favorites',
    'project_favorites',
    'project_announcements',
    'project_deadlines',
    'project_invitations',
    'notifications'
  ];
  var legacyTables = {};

  for (var j = 0; j < tables.length; j += 1) {
    var table = tables[j];
    if (await tableExists(table)) {
      await rawRun('ALTER TABLE ' + table + ' RENAME TO ' + table + '_legacy_migration');
      legacyTables[table] = true;
    }
  }

  return legacyTables;
}

async function createCurrentSchema() {
  await rawRun(
    'CREATE TABLE IF NOT EXISTS users (' +
      'student_id TEXT PRIMARY KEY,' +
      'username TEXT,' +
      'name TEXT NOT NULL,' +
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
      'suspended_until TEXT,' +
      'banned_until TEXT,' +
      'token_version INTEGER DEFAULT 0,' +
      'suspended_reason TEXT,' +
      'created_at TEXT DEFAULT CURRENT_TIMESTAMP' +
    ')'
  );
  await addColumn('users', 'username TEXT');
  await addColumn('users', 'role TEXT DEFAULT "user"');
  await addColumn('users', 'avatar TEXT');
  await addColumn('users', 'department TEXT');
  await addColumn('users', 'grade TEXT');
  await addColumn('users', 'skills TEXT DEFAULT ""');
  await addColumn('users', 'github_url TEXT');
  await addColumn('users', 'is_suspended INTEGER DEFAULT 0');
  await addColumn('users', 'suspended_until TEXT');
  await addColumn('users', 'banned_until TEXT');
  await addColumn('users', 'token_version INTEGER DEFAULT 0');
  await addColumn('users', 'suspended_reason TEXT');
  await rawRun('UPDATE users SET username = name WHERE username IS NULL OR username = ""');
  await rawRun('UPDATE users SET role = "user" WHERE role IS NULL OR role = ""');
  await rawRun('UPDATE users SET is_suspended = 0 WHERE is_suspended IS NULL');
  await rawRun('UPDATE users SET token_version = 0 WHERE token_version IS NULL');
  await rawRun('UPDATE users SET banned_until = suspended_until WHERE banned_until IS NULL AND suspended_until IS NOT NULL');
  await rawRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL');

  await rawRun(
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
      'github_url TEXT,' +
      'owner_id TEXT NOT NULL,' +
      'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
      'FOREIGN KEY(owner_id) REFERENCES users(student_id) ON DELETE CASCADE' +
    ')'
  );
  await addColumn('projects', 'accepting_applications INTEGER DEFAULT 1');
  await addColumn('projects', 'github_url TEXT');

  await rawRun(
    'CREATE TABLE IF NOT EXISTS applications (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'project_id INTEGER NOT NULL,' +
      'user_id TEXT NOT NULL,' +
      'message TEXT,' +
      'status TEXT DEFAULT "pending",' +
      'role TEXT DEFAULT "member",' +
      'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
      'UNIQUE(project_id, user_id),' +
      'FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,' +
      'FOREIGN KEY(user_id) REFERENCES users(student_id) ON DELETE CASCADE' +
    ')'
  );
  await addColumn('applications', 'role TEXT DEFAULT "member"');
  await rawRun('UPDATE applications SET role = "member" WHERE role IS NULL OR role = ""');
  await rawRun(
    'CREATE TABLE IF NOT EXISTS comments (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'project_id INTEGER NOT NULL,' +
      'user_id TEXT NOT NULL,' +
      'content TEXT NOT NULL,' +
      'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
      'FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,' +
      'FOREIGN KEY(user_id) REFERENCES users(student_id) ON DELETE CASCADE' +
    ')'
  );
  await rawRun(
    'CREATE TABLE IF NOT EXISTS favorites (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'project_id INTEGER NOT NULL,' +
      'user_id TEXT NOT NULL,' +
      'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
      'UNIQUE(project_id, user_id),' +
      'FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,' +
      'FOREIGN KEY(user_id) REFERENCES users(student_id) ON DELETE CASCADE' +
    ')'
  );
  await rawRun(
    'CREATE TABLE IF NOT EXISTS project_favorites (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'user_id TEXT NOT NULL,' +
      'project_id INTEGER NOT NULL,' +
      'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
      'UNIQUE(user_id, project_id),' +
      'FOREIGN KEY(user_id) REFERENCES users(student_id) ON DELETE CASCADE,' +
      'FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE' +
    ')'
  );
  await rawRun(
    'CREATE TABLE IF NOT EXISTS project_announcements (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'project_id INTEGER NOT NULL,' +
      'author_id TEXT NOT NULL,' +
      'content TEXT NOT NULL,' +
      'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
      'updated_at TEXT,' +
      'FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,' +
      'FOREIGN KEY(author_id) REFERENCES users(student_id) ON DELETE CASCADE' +
    ')'
  );
  await rawRun(
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
  await rawRun(
    'CREATE TABLE IF NOT EXISTS group_countdowns (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'group_id INTEGER NOT NULL,' +
      'title TEXT NOT NULL,' +
      'description TEXT,' +
      'target_time TEXT NOT NULL,' +
      'created_by TEXT NOT NULL,' +
      'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
      'updated_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
      'FOREIGN KEY(group_id) REFERENCES projects(id) ON DELETE CASCADE,' +
      'FOREIGN KEY(created_by) REFERENCES users(student_id) ON DELETE CASCADE' +
    ')'
  );
  await rawRun(
    'CREATE TABLE IF NOT EXISTS project_invitations (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'project_id INTEGER NOT NULL,' +
      'inviter_id TEXT NOT NULL,' +
      'invitee_id TEXT NOT NULL,' +
      'message TEXT,' +
      'status TEXT DEFAULT "pending",' +
      'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
      'responded_at TEXT,' +
      'UNIQUE(project_id, invitee_id),' +
      'FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,' +
      'FOREIGN KEY(inviter_id) REFERENCES users(student_id) ON DELETE CASCADE,' +
      'FOREIGN KEY(invitee_id) REFERENCES users(student_id) ON DELETE CASCADE' +
    ')'
  );
  await rawRun(
    'CREATE TABLE IF NOT EXISTS notifications (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'user_id TEXT NOT NULL,' +
      'type TEXT NOT NULL,' +
      'title TEXT NOT NULL,' +
      'content TEXT,' +
      'link TEXT,' +
      'is_read INTEGER DEFAULT 0,' +
      'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
      'FOREIGN KEY(user_id) REFERENCES users(student_id) ON DELETE CASCADE' +
    ')'
  );
  await rawRun(
    'CREATE TABLE IF NOT EXISTS reports (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'reporter_id TEXT NOT NULL,' +
      'target_user_id TEXT,' +
      'target_project_id INTEGER,' +
      'target_comment_id INTEGER,' +
      'reason TEXT NOT NULL,' +
      'detail TEXT,' +
      'status TEXT DEFAULT "pending",' +
      'handled_by TEXT,' +
      'handled_action TEXT,' +
      'handled_note TEXT,' +
      'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
      'handled_at TEXT,' +
      'FOREIGN KEY(reporter_id) REFERENCES users(student_id) ON DELETE CASCADE,' +
      'FOREIGN KEY(target_user_id) REFERENCES users(student_id) ON DELETE SET NULL,' +
      'FOREIGN KEY(target_project_id) REFERENCES projects(id) ON DELETE CASCADE,' +
      'FOREIGN KEY(target_comment_id) REFERENCES comments(id) ON DELETE SET NULL,' +
      'FOREIGN KEY(handled_by) REFERENCES users(student_id) ON DELETE SET NULL' +
    ')'
  );
  await rawRun(
    'CREATE TABLE IF NOT EXISTS user_warnings (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'user_id TEXT NOT NULL,' +
      'message TEXT NOT NULL,' +
      'created_by TEXT NOT NULL,' +
      'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
      'FOREIGN KEY(user_id) REFERENCES users(student_id) ON DELETE CASCADE,' +
      'FOREIGN KEY(created_by) REFERENCES users(student_id) ON DELETE CASCADE' +
    ')'
  );
  await rawRun(
    'CREATE TABLE IF NOT EXISTS punishments (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'user_id TEXT NOT NULL,' +
      'admin_id TEXT NOT NULL,' +
      'type TEXT NOT NULL,' +
      'message TEXT,' +
      'ban_days INTEGER,' +
      'banned_until TEXT,' +
      'created_at TEXT DEFAULT CURRENT_TIMESTAMP,' +
      'FOREIGN KEY(user_id) REFERENCES users(student_id) ON DELETE CASCADE,' +
      'FOREIGN KEY(admin_id) REFERENCES users(student_id) ON DELETE CASCADE' +
    ')'
  );
}

async function copyLegacyTable(table, targetColumns, selectExpressions) {
  if (!(await tableExists(table + '_legacy_migration'))) {
    return;
  }
  await rawRun(
    'INSERT OR IGNORE INTO ' + table + ' (' + targetColumns.join(', ') + ') ' +
      'SELECT ' + selectExpressions.join(', ') + ' FROM ' + table + '_legacy_migration'
  );
}

async function copyLegacyData(legacyTables) {
  var columns;

  if (legacyTables.users) {
    columns = await tableColumns('users_legacy_migration');
    await copyLegacyTable(
      'users',
      [
        'student_id',
        'username',
        'name',
        'class_name',
        'email',
        'password',
        'role',
        'avatar',
        'department',
        'grade',
        'skills',
        'bio',
        'github_url',
        'is_suspended',
        'suspended_until',
        'banned_until',
        'token_version',
        'suspended_reason',
        'created_at'
      ],
      [
        'student_id',
        coalesceColumnExpr(columns, 'username', 'name'),
        columnExpr(columns, 'name', '"未命名使用者"'),
        columnExpr(columns, 'class_name', 'NULL'),
        columnExpr(columns, 'email', 'student_id || "@legacy.local"'),
        columnExpr(columns, 'password', '""'),
        coalesceColumnExpr(columns, 'role', '"user"'),
        columnExpr(columns, 'avatar', 'NULL'),
        columnExpr(columns, 'department', 'NULL'),
        columnExpr(columns, 'grade', 'NULL'),
        columnExpr(columns, 'skills', 'NULL'),
        columnExpr(columns, 'bio', 'NULL'),
        columnExpr(columns, 'github_url', 'NULL'),
        coalesceColumnExpr(columns, 'is_suspended', '0'),
        columnExpr(columns, 'suspended_until', 'NULL'),
        columnExpr(columns, 'banned_until', columnExpr(columns, 'suspended_until', 'NULL')),
        coalesceColumnExpr(columns, 'token_version', '0'),
        columnExpr(columns, 'suspended_reason', 'NULL'),
        columnExpr(columns, 'created_at', 'CURRENT_TIMESTAMP')
      ]
    );
  }

  if (legacyTables.projects) {
    columns = await tableColumns('projects_legacy_migration');
    await copyLegacyTable(
      'projects',
      ['id', 'title', 'course_name', 'teacher_name', 'description', 'required_skills', 'current_members', 'max_members', 'status', 'accepting_applications', 'contact', 'github_url', 'owner_id', 'created_at'],
      [
        columnExpr(columns, 'id', 'NULL'),
        columnExpr(columns, 'title', '"未命名專題"'),
        columnExpr(columns, 'course_name', 'NULL'),
        columnExpr(columns, 'teacher_name', 'NULL'),
        columnExpr(columns, 'description', '""'),
        columnExpr(columns, 'required_skills', 'NULL'),
        coalesceColumnExpr(columns, 'current_members', '1'),
        coalesceColumnExpr(columns, 'max_members', '4'),
        coalesceColumnExpr(columns, 'status', '"open"'),
        coalesceColumnExpr(columns, 'accepting_applications', '1'),
        columnExpr(columns, 'contact', 'NULL'),
        columnExpr(columns, 'github_url', 'NULL'),
        legacyUserReferenceExpr(columns, 'owner_id'),
        columnExpr(columns, 'created_at', 'CURRENT_TIMESTAMP')
      ]
    );
  }

  if (legacyTables.applications) {
    columns = await tableColumns('applications_legacy_migration');
    await copyLegacyTable(
      'applications',
      ['id', 'project_id', 'user_id', 'message', 'status', 'created_at'],
      [
        columnExpr(columns, 'id', 'NULL'),
        columnExpr(columns, 'project_id', 'NULL'),
        legacyUserReferenceExpr(columns, 'user_id'),
        columnExpr(columns, 'message', 'NULL'),
        coalesceColumnExpr(columns, 'status', '"pending"'),
        columnExpr(columns, 'created_at', 'CURRENT_TIMESTAMP')
      ]
    );
  }

  if (legacyTables.comments) {
    columns = await tableColumns('comments_legacy_migration');
    await copyLegacyTable(
      'comments',
      ['id', 'project_id', 'user_id', 'content', 'created_at'],
      [
        columnExpr(columns, 'id', 'NULL'),
        columnExpr(columns, 'project_id', 'NULL'),
        legacyUserReferenceExpr(columns, 'user_id'),
        columnExpr(columns, 'content', '""'),
        columnExpr(columns, 'created_at', 'CURRENT_TIMESTAMP')
      ]
    );
  }

  if (legacyTables.favorites) {
    columns = await tableColumns('favorites_legacy_migration');
    await copyLegacyTable(
      'favorites',
      ['id', 'project_id', 'user_id', 'created_at'],
      [
        columnExpr(columns, 'id', 'NULL'),
        columnExpr(columns, 'project_id', 'NULL'),
        legacyUserReferenceExpr(columns, 'user_id'),
        columnExpr(columns, 'created_at', 'CURRENT_TIMESTAMP')
      ]
    );
  }

  if (legacyTables.project_favorites) {
    columns = await tableColumns('project_favorites_legacy_migration');
    await copyLegacyTable(
      'project_favorites',
      ['id', 'user_id', 'project_id', 'created_at'],
      [
        columnExpr(columns, 'id', 'NULL'),
        legacyUserReferenceExpr(columns, 'user_id'),
        columnExpr(columns, 'project_id', 'NULL'),
        columnExpr(columns, 'created_at', 'CURRENT_TIMESTAMP')
      ]
    );
  }

  if (legacyTables.project_announcements) {
    columns = await tableColumns('project_announcements_legacy_migration');
    await copyLegacyTable(
      'project_announcements',
      ['id', 'project_id', 'author_id', 'content', 'created_at', 'updated_at'],
      [
        columnExpr(columns, 'id', 'NULL'),
        columnExpr(columns, 'project_id', 'NULL'),
        legacyUserReferenceExpr(columns, 'author_id'),
        columnExpr(columns, 'content', '""'),
        columnExpr(columns, 'created_at', 'CURRENT_TIMESTAMP'),
        columnExpr(columns, 'updated_at', 'NULL')
      ]
    );
  }

  if (legacyTables.project_deadlines) {
    columns = await tableColumns('project_deadlines_legacy_migration');
    await copyLegacyTable(
      'project_deadlines',
      ['id', 'project_id', 'title', 'deadline_date', 'description', 'created_at', 'updated_at'],
      [
        columnExpr(columns, 'id', 'NULL'),
        columnExpr(columns, 'project_id', 'NULL'),
        columnExpr(columns, 'title', '"未命名日期"'),
        columnExpr(columns, 'deadline_date', 'CURRENT_DATE'),
        columnExpr(columns, 'description', 'NULL'),
        columnExpr(columns, 'created_at', 'CURRENT_TIMESTAMP'),
        columnExpr(columns, 'updated_at', 'NULL')
      ]
    );
  }

  if (legacyTables.project_invitations) {
    columns = await tableColumns('project_invitations_legacy_migration');
    await copyLegacyTable(
      'project_invitations',
      ['id', 'project_id', 'inviter_id', 'invitee_id', 'message', 'status', 'created_at', 'responded_at'],
      [
        columnExpr(columns, 'id', 'NULL'),
        columnExpr(columns, 'project_id', 'NULL'),
        legacyUserReferenceExpr(columns, 'inviter_id'),
        legacyUserReferenceExpr(columns, 'invitee_id'),
        columnExpr(columns, 'message', 'NULL'),
        coalesceColumnExpr(columns, 'status', '"pending"'),
        columnExpr(columns, 'created_at', 'CURRENT_TIMESTAMP'),
        columnExpr(columns, 'responded_at', 'NULL')
      ]
    );
  }

  if (legacyTables.notifications) {
    columns = await tableColumns('notifications_legacy_migration');
    await copyLegacyTable(
      'notifications',
      ['id', 'user_id', 'type', 'title', 'content', 'link', 'is_read', 'created_at'],
      [
        columnExpr(columns, 'id', 'NULL'),
        legacyUserReferenceExpr(columns, 'user_id'),
        columnExpr(columns, 'type', '"system"'),
        columnExpr(columns, 'title', '""'),
        columnExpr(columns, 'content', 'NULL'),
        columnExpr(columns, 'link', 'NULL'),
        coalesceColumnExpr(columns, 'is_read', '0'),
        columnExpr(columns, 'created_at', 'CURRENT_TIMESTAMP')
      ]
    );
  }

  var tables = Object.keys(legacyTables);
  for (var i = 0; i < tables.length; i += 1) {
    await rawRun('DROP TABLE IF EXISTS ' + tables[i] + '_legacy_migration');
  }
}

async function seedSuperAdmin() {
  var hash = bcrypt.hashSync('admin2006', 10);

  await rawRun(
    'INSERT OR IGNORE INTO users (username, name, student_id, email, password, role, is_suspended) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['admin2006', 'admin2006', 'ADMIN2006', 'admin@gmail.com', hash, 'super_admin', 0]
  );
  await rawRun(
    'UPDATE users SET username = ?, name = ?, password = ?, role = ?, is_suspended = 0 WHERE email = ?',
    ['admin2006', 'admin2006', hash, 'super_admin', 'admin@gmail.com']
  );
}

async function init() {
  await rawRun('PRAGMA foreign_keys = OFF');
  var legacyTables = await prepareLegacyMigration();
  await createCurrentSchema();
  if (legacyTables) {
    await copyLegacyData(legacyTables);
  }
  await seedSuperAdmin();
  await rawRun('PRAGMA foreign_keys = ON');
}

var ready = init();

module.exports = {
  all: all,
  get: get,
  run: run,
  close: close
};
