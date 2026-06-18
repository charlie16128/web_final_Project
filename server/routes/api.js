var express = require('express');
var bcrypt = require('bcrypt');
var db = require('../database/db');
var auth = require('../middleware/auth');

var router = express.Router();
var VALID_APPLICATION_STATUS = ['pending', 'accepted', 'rejected'];
var VALID_PROJECT_STATUS = ['open', 'full', 'closed'];

router.get('/', function(req, res, next) {
  if (req.query.test !== undefined) {
    db.get('SELECT name FROM users WHERE student_id = ?', [req.query.test])
      .then(function(user) {
        if (!user) {
          res.status(404).send('找不到此學號');
          return;
        }

        res.send('Student ID = ' + req.query.test + ' | Name = ' + user.name);
      })
      .catch(next);
    return;
  }

  res.json({ message: 'This is TeamUp Campus API' });
});

function asyncHandler(fn) {
  return function(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function required(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function publicUser(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.student_id,
    username: row.username || row.name,
    name: row.name,
    student_id: row.student_id,
    email: row.email,
    role: row.role || 'user',
    avatar: row.avatar || '',
    department: row.department || '',
    grade: row.grade || '',
    skills: row.skills || '',
    bio: row.bio || '',
    github_url: row.github_url || '',
    is_suspended: row.is_suspended || 0,
    suspended_until: row.suspended_until || null,
    banned_until: row.banned_until || row.suspended_until || null,
    token_version: Number(row.token_version || 0),
    suspended_reason: row.suspended_reason || '',
    created_at: row.created_at
  };
}

function boolToInt(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return value === true || value === 'true' || value === 1 || value === '1' ? 1 : 0;
}

function projectStatusFromCapacity(currentMembers, maxMembers) {
  var current = Number(currentMembers || 0);
  var max = Number(maxMembers || 0);

  if (max > 0 && current >= max) {
    return 'full';
  }
  return 'open';
}

function isAdminRole(user) {
  return user && (user.role === 'admin' || user.role === 'super_admin');
}

function requireAdmin(req, res, next) {
  currentUser(req.user.student_id)
    .then(function(user) {
      if (!isAdminRole(user)) {
        res.status(403).json({ message: '需要管理員權限' });
        return;
      }
      req.adminUser = user;
      next();
    })
    .catch(next);
}

function isActiveSuspension(user) {
  if (!user || !user.is_suspended) {
    return false;
  }
  var until = user.banned_until || user.suspended_until;
  if (!until) {
    return true;
  }
  return new Date(until).getTime() > Date.now();
}

function suspensionMessage(user) {
  var until = user.banned_until || user.suspended_until;
  if (!until) {
    return '帳號已被永久停權' + (user.suspended_reason ? '：' + user.suspended_reason : '');
  }
  return '帳號停權至 ' + until + (user.suspended_reason ? '：' + user.suspended_reason : '');
}

function hasGranularBanDuration(body) {
  return ['days', 'hours', 'minutes', 'seconds'].some(function(key) {
    return body[key] !== undefined && body[key] !== null && body[key] !== '';
  });
}

function integerFromBody(body, key) {
  if (body[key] === undefined || body[key] === null || body[key] === '') {
    return 0;
  }
  return Number(body[key]);
}

function validateBanDuration(body) {
  if (!hasGranularBanDuration(body)) {
    return validateBanDays(body.ban_days);
  }

  var days = integerFromBody(body, 'days');
  var hours = integerFromBody(body, 'hours');
  var minutes = integerFromBody(body, 'minutes');
  var seconds = integerFromBody(body, 'seconds');
  if (![days, hours, minutes, seconds].every(Number.isInteger)) {
    return false;
  }
  return (
    days >= 0 && days <= 365 &&
    hours >= 0 && hours <= 23 &&
    minutes >= 0 && minutes <= 59 &&
    seconds >= 0 && seconds <= 59 &&
    days + hours + minutes + seconds > 0
  );
}

function bannedUntilFromDuration(body) {
  if (!hasGranularBanDuration(body)) {
    return bannedUntilFromDays(body.ban_days);
  }

  var totalMs =
    integerFromBody(body, 'days') * 24 * 60 * 60 * 1000 +
    integerFromBody(body, 'hours') * 60 * 60 * 1000 +
    integerFromBody(body, 'minutes') * 60 * 1000 +
    integerFromBody(body, 'seconds') * 1000;
  var until = new Date();
  until = new Date(until.getTime() + totalMs);
  return until.toISOString();
}

function bannedUntilFromDays(days) {
  if (days === null || days === undefined || days === '') {
    return null;
  }
  var banDays = Number(days);
  var until = new Date();
  until.setDate(until.getDate() + banDays);
  return until.toISOString();
}

function validateBanDays(days) {
  if (days === null || days === undefined || days === '') {
    return true;
  }
  var value = Number(days);
  return Number.isInteger(value) && value >= 1 && value <= 365;
}

function banDaysForAudit(body) {
  if (!hasGranularBanDuration(body)) {
    return body.ban_days === null || body.ban_days === undefined || body.ban_days === '' ? null : Number(body.ban_days);
  }
  var totalDays =
    integerFromBody(body, 'days') +
    integerFromBody(body, 'hours') / 24 +
    integerFromBody(body, 'minutes') / 1440 +
    integerFromBody(body, 'seconds') / 86400;
  return Math.max(1, Math.ceil(totalDays));
}

function isProjectAtCapacity(project) {
  return Number(project.current_members || 0) >= Number(project.max_members || 0);
}

async function syncProjectCapacity(projectId) {
  var project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (!project) {
    return null;
  }

  var nextStatus = projectStatusFromCapacity(project.current_members, project.max_members);
  if (nextStatus !== project.status) {
    await db.run('UPDATE projects SET status = ? WHERE id = ?', [nextStatus, projectId]);
    project.status = nextStatus;
  }
  return project;
}

async function createNotification(studentId, type, title, content, link) {
  if (!studentId) {
    return;
  }
  await db.run(
    'INSERT INTO notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)',
    [studentId, type, title, content || '', link || '']
  );
}

async function currentUser(studentId) {
  return db.get('SELECT * FROM users WHERE student_id = ?', [studentId]);
}

async function groupOrAdminForUser(projectId, userId) {
  var user = await currentUser(userId);
  if (!user) {
    return null;
  }

  var memberProject = await groupForUser(projectId, userId);
  if (memberProject) {
    return memberProject;
  }

  if (isAdminRole(user)) {
    var adminProject = await db.get(
      'SELECT projects.*, users.name AS owner_name, users.role AS owner_role, "admin" AS relation, "admin" AS group_role ' +
        'FROM projects JOIN users ON users.student_id = projects.owner_id WHERE projects.id = ?',
      [projectId]
    );
    return adminProject || null;
  }

  return null;
}

async function manageableProjectForUser(projectId, userId) {
  var user = await currentUser(userId);
  if (!user) {
    return null;
  }

  var project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (!project) {
    return null;
  }

  project.group_role = await getGroupRole(projectId, user.student_id);
  project.can_manage = canManageGroup(project.group_role) || isAdminRole(user);
  project.can_transfer_leader = project.group_role === 'leader' || isAdminRole(user);
  project.can_delete_group = project.group_role === 'leader' || isAdminRole(user);
  return project;
}

async function getGroupRole(projectId, userId) {
  var project = await db.get('SELECT owner_id FROM projects WHERE id = ?', [projectId]);
  if (!project) {
    return null;
  }
  if (project.owner_id === userId) {
    return 'leader';
  }

  var membership = await db.get(
    'SELECT role FROM applications WHERE project_id = ? AND user_id = ? AND status = "accepted"',
    [projectId, userId]
  );
  if (!membership) {
    return null;
  }
  return membership.role === 'vice_leader' ? 'vice_leader' : 'member';
}

function canManageGroup(groupRole) {
  return groupRole === 'leader' || groupRole === 'vice_leader';
}

async function groupMemberById(projectId, memberId) {
  var project = await db.get(
    'SELECT users.student_id AS id, users.student_id, users.name, users.username, users.email, users.role, ' +
      '"owned" AS relation, "leader" AS group_role, projects.created_at AS joined_at ' +
      'FROM projects JOIN users ON users.student_id = projects.owner_id ' +
      'WHERE projects.id = ? AND users.student_id = ?',
    [projectId, memberId]
  );
  if (project) {
    return project;
  }

  return db.get(
    'SELECT users.student_id AS id, users.student_id, users.name, users.username, users.email, users.role, ' +
      '"joined" AS relation, COALESCE(applications.role, "member") AS group_role, applications.created_at AS joined_at ' +
      'FROM applications JOIN users ON users.student_id = applications.user_id ' +
      'WHERE applications.project_id = ? AND applications.user_id = ? AND applications.status = "accepted"',
    [projectId, memberId]
  );
}

router.post('/register', asyncHandler(async function(req, res) {
  var body = req.body;
  if (!required(body.name) || !required(body.student_id) || !required(body.email) || !required(body.password)) {
    res.status(400).json({ message: '姓名、學號、Email 與密碼皆為必填' });
    return;
  }

  if (!/^D[0-9]{7}$/.test(body.student_id)) {
    res.status(400).json({ message: '學號格式必須為 D 加 7 位數字，例如 D1234567' });
    return;
  }

  if (!/^[A-Za-z0-9]{6,}$/.test(body.password)) {
    res.status(400).json({ message: '密碼至少 6 碼，且只能包含英文字母與數字' });
    return;
  }

  var exists = await db.get('SELECT student_id FROM users WHERE email = ?', [body.email]);
  if (exists) {
    res.status(409).json({ message: 'Email 已被使用' });
    return;
  }

  exists = await db.get('SELECT student_id FROM users WHERE student_id = ?', [body.student_id]);
  if (exists) {
    res.status(409).json({ message: '學號已被使用' });
    return;
  }

  var hash = await bcrypt.hash(body.password, 10);
  await db.run(
    'INSERT INTO users (username, name, student_id, email, password, role) VALUES (?, ?, ?, ?, ?, ?)',
    [body.name, body.name, body.student_id, body.email, hash, 'user']
  );
  var user = await db.get('SELECT * FROM users WHERE student_id = ?', [body.student_id]);
  res.status(201).json({ token: auth.signToken(user), user: publicUser(user) });
}));


router.post('/login', asyncHandler(async function(req, res) {
  var body = req.body;
  if (!required(body.email) || !required(body.password)) {
    res.status(400).json({ message: 'Email 與密碼為必填' });
    return;
  }

  var user = await db.get('SELECT * FROM users WHERE email = ?', [body.email]);
  if (!user || !(await bcrypt.compare(body.password, user.password))) {
    res.status(401).json({ message: '帳號或密碼錯誤' });
    return;
  }

  var suspendedUntil = user.banned_until || user.suspended_until;
  if (user.is_suspended && suspendedUntil && new Date(suspendedUntil).getTime() <= Date.now()) {
    await db.run(
      'UPDATE users SET is_suspended = 0, suspended_until = NULL, banned_until = NULL, suspended_reason = NULL WHERE student_id = ?',
      [user.student_id]
    );
    user.is_suspended = 0;
    user.suspended_until = null;
    user.banned_until = null;
    user.suspended_reason = null;
  }

  if (isActiveSuspension(user)) {
    res.status(403).json({
      message: suspensionMessage(user),
      banned_until: user.banned_until || user.suspended_until || null
    });
    return;
  }

  res.json({ token: auth.signToken(user), user: publicUser(user) });
}));


// 這個是用來測試sql injection的/login api 請不要使用
// router.post('/login', asyncHandler(async function(req, res) {
//   var body = req.body;
//   if (!required(body.email) || !required(body.password)) {
//     res.status(400).json({ message: 'Email 與密碼為必填' });
//     return;
//   }

//   var user = await db.get('SELECT * FROM users WHERE email = ?', [body.email]);
//   if (!user) {
//     res.status(401).json({ message: '帳號或密碼錯誤' });
//     return;
//   }

//   var passwordCorrect = await bcrypt.compare(body.password, user.password);

//   // SQL injection demo only: this intentionally concatenates the password.
//   var injectionSql =
//     "SELECT 1 AS ok WHERE 'demo' = '" +
//     body.password +
//     "'";

//   console.log('[CAUTION! THIS IS A SQL injection API]', injectionSql);

//   var injectionResult = await db.get(injectionSql);
//   if (!passwordCorrect && !injectionResult) {
//     res.status(401).json({ message: '帳號或密碼錯誤' });
//     return;
//   }

//   res.json({ token: auth.signToken(user), user: publicUser(user) });
// }));

router.get('/users/me', auth.authRequired, asyncHandler(async function(req, res) {
  var user = await db.get('SELECT * FROM users WHERE student_id = ?', [req.user.student_id]);
  if (!user) {
    res.status(401).json({ message: '登入狀態已失效，請重新登入' });
    return;
  }
  res.json({ user: publicUser(user) });
}));

router.put('/users/me', auth.authRequired, asyncHandler(async function(req, res) {
  var body = req.body;
  var studentId = req.user.student_id;
  var currentUser = await db.get('SELECT student_id FROM users WHERE student_id = ?', [studentId]);
  if (!currentUser) {
    res.status(401).json({ message: '登入狀態已失效，請重新登入' });
    return;
  }

  if (!required(body.email)) {
    res.status(400).json({ message: 'Email 為必填' });
    return;
  }

  var email = String(body.email).trim();
  var exists = await db.get('SELECT student_id FROM users WHERE email = ? AND student_id != ?', [email, studentId]);
  if (exists) {
    res.status(409).json({ message: 'Email 已被使用' });
    return;
  }

  if (required(body.password)) {
    if (!/^[A-Za-z0-9]{6,}$/.test(body.password)) {
      res.status(400).json({ message: '密碼至少 6 碼，且只能包含英文字母與數字' });
      return;
    }
    var hash = await bcrypt.hash(body.password, 10);
    await db.run('UPDATE users SET email = ?, password = ? WHERE student_id = ?', [email, hash, studentId]);
  } else {
    await db.run('UPDATE users SET email = ? WHERE student_id = ?', [email, studentId]);
  }

  var user = await db.get('SELECT * FROM users WHERE student_id = ?', [studentId]);
  res.json({ user: publicUser(user) });
}));

router.post('/reports', auth.authRequired, asyncHandler(async function(req, res) {
  var body = req.body;
  if (!required(body.reason)) {
    res.status(400).json({ message: '請輸入檢舉原因' });
    return;
  }
  if (!required(body.target_user_id) && !required(body.target_project_id) && !required(body.target_comment_id)) {
    res.status(400).json({ message: '請選擇檢舉對象' });
    return;
  }

  var targetUserId = required(body.target_user_id) ? String(body.target_user_id).trim() : null;
  var targetProjectId = required(body.target_project_id) ? Number(body.target_project_id) : null;
  var targetCommentId = required(body.target_comment_id) ? Number(body.target_comment_id) : null;

  if (targetUserId) {
    var targetUser = await db.get('SELECT student_id FROM users WHERE student_id = ?', [targetUserId]);
    if (!targetUser) {
      res.status(404).json({ message: '找不到被檢舉的使用者' });
      return;
    }
  }

  if (targetProjectId) {
    var targetProject = await db.get('SELECT id FROM projects WHERE id = ?', [targetProjectId]);
    if (!targetProject) {
      res.status(404).json({ message: '找不到被檢舉的專題' });
      return;
    }
  }

  if (targetCommentId) {
    var targetComment = await db.get('SELECT id, user_id, project_id FROM comments WHERE id = ?', [targetCommentId]);
    if (!targetComment) {
      res.status(404).json({ message: '找不到被檢舉的留言' });
      return;
    }
    targetUserId = targetUserId || targetComment.user_id;
    targetProjectId = targetProjectId || targetComment.project_id;
  }

  var result = await db.run(
    'INSERT INTO reports (reporter_id, target_user_id, target_project_id, target_comment_id, reason, detail) ' +
      'VALUES (?, ?, ?, ?, ?, ?)',
    [
      req.user.student_id,
      targetUserId,
      targetProjectId,
      targetCommentId,
      String(body.reason).trim(),
      body.detail || ''
    ]
  );

  res.status(201).json({ report: await reportById(result.id) });
}));

router.get('/me/warnings', auth.authRequired, asyncHandler(async function(req, res) {
  var warnings = await db.all(
    'SELECT id, message, created_at FROM user_warnings WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.student_id]
  );
  res.json({ warnings: warnings });
}));

router.delete('/me/warnings/:id', auth.authRequired, asyncHandler(async function(req, res) {
  var deleted = await db.run(
    'DELETE FROM user_warnings WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.student_id]
  );
  if (!deleted.changes) {
    res.status(404).json({ message: '找不到警告訊息' });
    return;
  }
  res.json({ message: '警告已讀' });
}));

router.use('/admin', auth.authRequired, requireAdmin);

router.get('/admin/reports', asyncHandler(async function(req, res) {
  var status = req.query.status || 'pending';
  var allowed = ['pending', 'ignored', 'handled', 'all'];
  if (allowed.indexOf(status) < 0) {
    res.status(400).json({ message: '檢舉狀態不正確' });
    return;
  }

  var where = status === 'all' ? '' : 'WHERE reports.status = ? ';
  var params = status === 'all' ? [] : [status];
  var reports = await db.all(reportSelectSql(where + 'ORDER BY reports.created_at DESC'), params);
  res.json({ reports: reports });
}));

router.patch('/admin/reports/:id/ignore', asyncHandler(async function(req, res) {
  var updated = await db.run(
    'UPDATE reports SET status = "ignored", handled_action = "ignore", handled_by = ?, handled_note = ?, handled_at = CURRENT_TIMESTAMP WHERE id = ? AND status = "pending"',
    [req.adminUser.student_id, req.body.note || '', req.params.id]
  );
  if (!updated.changes) {
    res.status(404).json({ message: '找不到待處理檢舉' });
    return;
  }
  res.json({ report: await reportById(req.params.id) });
}));

router.patch('/admin/reports/:id/warn', asyncHandler(async function(req, res) {
  var report = await reportById(req.params.id);
  if (!report || report.status !== 'pending') {
    res.status(404).json({ message: '找不到待處理檢舉' });
    return;
  }

  var targetUserId = req.body.target_user_id || report.target_user_id;
  if (!required(targetUserId) || !required(req.body.message)) {
    res.status(400).json({ message: '請輸入警告對象與內容' });
    return;
  }

  var targetUser = await currentUser(String(targetUserId).trim());
  if (!targetUser) {
    res.status(404).json({ message: '找不到使用者' });
    return;
  }
  if (targetUser.role === 'super_admin') {
    res.status(400).json({ message: '不能警告 super_admin' });
    return;
  }

  await db.run(
    'INSERT INTO user_warnings (user_id, message, created_by) VALUES (?, ?, ?)',
    [targetUser.student_id, String(req.body.message).trim(), req.adminUser.student_id]
  );
  await db.run(
    'INSERT INTO punishments (user_id, admin_id, type, message) VALUES (?, ?, "warning", ?)',
    [targetUser.student_id, req.adminUser.student_id, String(req.body.message).trim()]
  );
  await db.run(
    'UPDATE reports SET status = "handled", handled_action = "warning", handled_by = ?, handled_note = ?, handled_at = CURRENT_TIMESTAMP WHERE id = ?',
    [req.adminUser.student_id, String(req.body.message).trim(), req.params.id]
  );

  res.json({ report: await reportById(req.params.id) });
}));

router.patch('/admin/reports/:id/ban', asyncHandler(async function(req, res) {
  var report = await reportById(req.params.id);
  if (!report || report.status !== 'pending') {
    res.status(404).json({ message: '找不到待處理檢舉' });
    return;
  }

  var targetUserId = req.body.target_user_id || report.target_user_id;
  if (!required(targetUserId) || !required(req.body.reason)) {
    res.status(400).json({ message: '請輸入停權對象與原因' });
    return;
  }
  if (!validateBanDuration(req.body)) {
    res.status(400).json({ message: '停權時間不可為負數，時分秒需在有效範圍，且不可全部為 0' });
    return;
  }

  var targetUser = await currentUser(String(targetUserId).trim());
  if (!targetUser) {
    res.status(404).json({ message: '找不到使用者' });
    return;
  }
  if (targetUser.role === 'super_admin') {
    res.status(400).json({ message: '不能停權 super_admin' });
    return;
  }

  var bannedUntil = bannedUntilFromDuration(req.body);
  var action = bannedUntil ? 'temporary_ban' : 'permanent_ban';
  var banDays = bannedUntil ? banDaysForAudit(req.body) : null;
  var reason = String(req.body.reason).trim();

  await db.run(
    'UPDATE users SET is_suspended = 1, suspended_until = ?, banned_until = ?, suspended_reason = ?, token_version = COALESCE(token_version, 0) + 1 WHERE student_id = ?',
    [bannedUntil, bannedUntil, reason, targetUser.student_id]
  );
  await db.run(
    'INSERT INTO punishments (user_id, admin_id, type, message, ban_days, banned_until) VALUES (?, ?, ?, ?, ?, ?)',
    [targetUser.student_id, req.adminUser.student_id, action, reason, banDays, bannedUntil]
  );
  await db.run(
    'UPDATE reports SET status = "handled", handled_action = ?, handled_by = ?, handled_note = ?, handled_at = CURRENT_TIMESTAMP WHERE id = ?',
    [action, req.adminUser.student_id, reason, req.params.id]
  );

  res.json({ report: await reportById(req.params.id) });
}));

router.get('/admin/users', asyncHandler(async function(req, res) {
  var q = String(req.query.q || '').trim();
  var where = '';
  var params = [];

  if (q) {
    where = 'WHERE student_id LIKE ? OR email LIKE ? OR name LIKE ? ';
    params = ['%' + q + '%', '%' + q + '%', '%' + q + '%'];
  }

  var users = await db.all(
    'SELECT student_id, username, name, email, role, is_suspended, suspended_until, banned_until, suspended_reason, token_version, created_at ' +
      'FROM users ' + where + 'ORDER BY role DESC, created_at DESC',
    params
  );
  res.json({ users: users });
}));

router.patch('/admin/users/:student_id/role', asyncHandler(async function(req, res) {
  var role = req.body.role;
  if (role !== 'user' && role !== 'admin') {
    res.status(400).json({ message: '角色只能是 user 或 admin' });
    return;
  }

  var targetUser = await currentUser(req.params.student_id);
  if (!targetUser) {
    res.status(404).json({ message: '找不到使用者' });
    return;
  }
  if (targetUser.role === 'super_admin') {
    res.status(400).json({ message: '不能修改 super_admin 角色' });
    return;
  }

  await db.run('UPDATE users SET role = ? WHERE student_id = ?', [role, req.params.student_id]);
  res.json({ user: publicUser(await currentUser(req.params.student_id)) });
}));

router.post('/admin/users/:student_id/warn', asyncHandler(async function(req, res) {
  var targetUser = await currentUser(req.params.student_id);
  if (!targetUser) {
    res.status(404).json({ message: '找不到使用者' });
    return;
  }
  if (targetUser.role === 'super_admin') {
    res.status(400).json({ message: '不能警告 super_admin' });
    return;
  }
  if (!required(req.body.message)) {
    res.status(400).json({ message: '請輸入警告內容' });
    return;
  }

  var message = String(req.body.message).trim();
  var result = await db.run(
    'INSERT INTO user_warnings (user_id, message, created_by) VALUES (?, ?, ?)',
    [targetUser.student_id, message, req.adminUser.student_id]
  );
  await db.run(
    'INSERT INTO punishments (user_id, admin_id, type, message) VALUES (?, ?, "warning", ?)',
    [targetUser.student_id, req.adminUser.student_id, message]
  );
  res.status(201).json({ warning: await db.get('SELECT * FROM user_warnings WHERE id = ?', [result.id]) });
}));

router.post('/admin/users/:student_id/ban', asyncHandler(async function(req, res) {
  var targetUser = await currentUser(req.params.student_id);
  if (!targetUser) {
    res.status(404).json({ message: '找不到使用者' });
    return;
  }
  if (targetUser.role === 'super_admin') {
    res.status(400).json({ message: '不能停權 super_admin' });
    return;
  }
  if (!required(req.body.reason) || !validateBanDuration(req.body)) {
    res.status(400).json({ message: '請輸入停權原因；停權時間不可為負數，時分秒需在有效範圍，且不可全部為 0' });
    return;
  }

  var bannedUntil = bannedUntilFromDuration(req.body);
  var action = bannedUntil ? 'temporary_ban' : 'permanent_ban';
  var banDays = bannedUntil ? banDaysForAudit(req.body) : null;
  var reason = String(req.body.reason).trim();

  await db.run(
    'UPDATE users SET is_suspended = 1, suspended_until = ?, banned_until = ?, suspended_reason = ?, token_version = COALESCE(token_version, 0) + 1 WHERE student_id = ?',
    [bannedUntil, bannedUntil, reason, targetUser.student_id]
  );
  await db.run(
    'INSERT INTO punishments (user_id, admin_id, type, message, ban_days, banned_until) VALUES (?, ?, ?, ?, ?, ?)',
    [targetUser.student_id, req.adminUser.student_id, action, reason, banDays, bannedUntil]
  );
  res.json({ user: publicUser(await currentUser(targetUser.student_id)) });
}));

router.post('/admin/users/:student_id/unban', asyncHandler(async function(req, res) {
  var targetUser = await currentUser(req.params.student_id);
  if (!targetUser) {
    res.status(404).json({ message: '找不到使用者' });
    return;
  }
  if (targetUser.role === 'super_admin') {
    res.status(400).json({ message: '不能操作 super_admin' });
    return;
  }

  await db.run(
    'UPDATE users SET is_suspended = 0, suspended_until = NULL, banned_until = NULL, suspended_reason = NULL, token_version = COALESCE(token_version, 0) + 1 WHERE student_id = ?',
    [targetUser.student_id]
  );
  await db.run(
    'INSERT INTO punishments (user_id, admin_id, type, message) VALUES (?, ?, "unban", ?)',
    [targetUser.student_id, req.adminUser.student_id, req.body.note || '解除停權']
  );
  res.json({ user: publicUser(await currentUser(targetUser.student_id)) });
}));

router.get('/projects', auth.optionalAuth, asyncHandler(async function(req, res) {
  var userId = req.user ? req.user.student_id : null;
  var favoriteFilter = req.query.filter === 'favorited';
  if (favoriteFilter && !userId) {
    res.status(401).json({ message: '請先登入' });
    return;
  }

  var rows = await db.all(
    'SELECT projects.*, users.name AS owner_name, users.role AS owner_role, ' +
      'CASE WHEN ? IS NULL THEN 0 ELSE EXISTS (' +
        'SELECT 1 FROM project_favorites ' +
        'WHERE project_favorites.project_id = projects.id ' +
        'AND project_favorites.user_id = ?' +
      ') END AS is_favorited ' +
      'FROM projects JOIN users ON users.student_id = projects.owner_id ' +
      'WHERE (? IS NULL OR projects.status = ?) ' +
      'AND (? IS NULL OR projects.title LIKE ? OR projects.course_name LIKE ? OR projects.required_skills LIKE ?) ' +
      'AND (? IS NULL OR projects.owner_id != ?) ' +
      'AND (? IS NULL OR NOT EXISTS (' +
        'SELECT 1 FROM applications ' +
        'WHERE applications.project_id = projects.id ' +
        'AND applications.user_id = ? ' +
        'AND applications.status = "accepted"' +
      ')) ' +
      'AND (? = 0 OR EXISTS (' +
        'SELECT 1 FROM project_favorites ' +
        'WHERE project_favorites.project_id = projects.id ' +
        'AND project_favorites.user_id = ?' +
      ')) ' +
      'ORDER BY projects.created_at DESC',
    [
      userId,
      userId,
      req.query.status || null,
      req.query.status || null,
      req.query.q || null,
      '%' + (req.query.q || '') + '%',
      '%' + (req.query.q || '') + '%',
      '%' + (req.query.q || '') + '%',
      userId,
      userId,
      userId,
      userId,
      favoriteFilter ? 1 : 0,
      userId
    ]
  );
  res.json({ projects: rows });
}));

router.post('/projects/:id/favorite', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await db.get('SELECT id FROM projects WHERE id = ?', [req.params.id]);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }

  await db.run(
    'INSERT OR IGNORE INTO project_favorites (user_id, project_id) VALUES (?, ?)',
    [req.user.student_id, req.params.id]
  );
  res.json({ favorited: true });
}));

router.delete('/projects/:id/favorite', auth.authRequired, asyncHandler(async function(req, res) {
  await db.run(
    'DELETE FROM project_favorites WHERE user_id = ? AND project_id = ?',
    [req.user.student_id, req.params.id]
  );
  res.json({ favorited: false });
}));

async function createProjectInvitation(req, res) {
  var project = await syncProjectCapacity(req.params.id);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  var manageableProject = await manageableProjectForUser(req.params.id, req.user.student_id);
  if (!manageableProject || !manageableProject.can_manage) {
    res.status(403).json({ message: '只有隊長或管理員可以邀請成員' });
    return;
  }
  if (!required(req.body.user_id)) {
    res.status(400).json({ message: '請選擇要邀請的使用者' });
    return;
  }
  if (isProjectAtCapacity(project)) {
    res.status(400).json({ message: '專題已滿員，不能邀請成員' });
    return;
  }

  var inviteeId = String(req.body.user_id).trim();
  if (!/^D[0-9]{7}$/.test(inviteeId)) {
    res.status(400).json({ message: '學號格式必須為 D 加 7 位數字，例如 D1234567' });
    return;
  }
  if (inviteeId === req.user.student_id) {
    res.status(400).json({ message: '不能邀請自己' });
    return;
  }

  var invitee = await db.get('SELECT student_id, name FROM users WHERE student_id = ?', [inviteeId]);
  if (!invitee) {
    res.status(404).json({ message: '找不到使用者' });
    return;
  }

  var existingMember = await db.get(
    'SELECT id FROM applications WHERE project_id = ? AND user_id = ? AND status = "accepted"',
    [req.params.id, inviteeId]
  );
  if (existingMember) {
    res.status(409).json({ message: '此使用者已是專題成員' });
    return;
  }

  var existingInvitation = await db.get(
    'SELECT id, status FROM project_invitations WHERE project_id = ? AND invitee_id = ?',
    [req.params.id, inviteeId]
  );
  if (existingInvitation) {
    if (existingInvitation.status === 'pending') {
      res.status(409).json({ message: '已經邀請過此使用者' });
      return;
    }
    await db.run('DELETE FROM project_invitations WHERE id = ?', [existingInvitation.id]);
  }

  var result = await db.run(
    'INSERT INTO project_invitations (project_id, inviter_id, invitee_id, message) VALUES (?, ?, ?, ?)',
    [req.params.id, req.user.student_id, inviteeId, req.body.message || '']
  ).catch(function(err) {
    if (err.message.indexOf('UNIQUE') >= 0) {
      err.status = 409;
      err.publicMessage = '已經邀請過此使用者';
    }
    throw err;
  });

  await createNotification(
    inviteeId,
    'project_invitation',
    '收到專題邀請',
    '你被邀請加入「' + project.title + '」',
    '/groups/' + project.id
  );

  res.status(201).json({ invitation: await invitationById(result.id) });
}

router.post('/projects/:id/invitations', auth.authRequired, asyncHandler(createProjectInvitation));
router.post('/groups/:id/invitations', auth.authRequired, asyncHandler(createProjectInvitation));

router.get('/me/invitations', auth.authRequired, asyncHandler(async function(req, res) {
  var invitations = await db.all(
    'SELECT project_invitations.*, projects.title AS project_title, projects.status AS project_status, ' +
      'users.name AS inviter_name, users.role AS inviter_role ' +
      'FROM project_invitations ' +
      'JOIN projects ON projects.id = project_invitations.project_id ' +
      'JOIN users ON users.student_id = project_invitations.inviter_id ' +
      'WHERE project_invitations.invitee_id = ? AND project_invitations.status = "pending" ' +
      'ORDER BY project_invitations.created_at DESC',
    [req.user.student_id]
  );
  res.json({ invitations: invitations });
}));

router.post('/invitations/:id/accept', auth.authRequired, asyncHandler(async function(req, res) {
  var invitation = await invitationById(req.params.id);
  if (!invitation) {
    res.status(404).json({ message: '找不到邀請' });
    return;
  }
  if (invitation.invitee_id !== req.user.student_id) {
    res.status(403).json({ message: '只能回覆自己的邀請' });
    return;
  }
  if (invitation.status !== 'pending') {
    res.status(400).json({ message: '此邀請已回覆' });
    return;
  }

  var project = await syncProjectCapacity(invitation.project_id);
  if (!project || isProjectAtCapacity(project)) {
    res.status(400).json({ message: '專題已滿員，不能接受邀請' });
    return;
  }

  var existingApplication = await db.get(
    'SELECT * FROM applications WHERE project_id = ? AND user_id = ?',
    [invitation.project_id, req.user.student_id]
  );
  if (existingApplication && existingApplication.status === 'accepted') {
    res.status(409).json({ message: '你已經是專題成員' });
    return;
  }

  if (existingApplication) {
    await db.run('UPDATE applications SET status = "accepted", role = "member" WHERE id = ?', [existingApplication.id]);
  } else {
    await db.run(
      'INSERT INTO applications (project_id, user_id, message, status, role) VALUES (?, ?, ?, "accepted", "member")',
      [invitation.project_id, req.user.student_id, invitation.message || '']
    );
  }

  await db.run(
    'UPDATE projects SET current_members = current_members + 1, status = CASE WHEN current_members + 1 >= max_members THEN "full" ELSE "open" END WHERE id = ?',
    [invitation.project_id]
  );
  await db.run('DELETE FROM project_invitations WHERE id = ?', [req.params.id]);
  await createNotification(
    invitation.inviter_id,
    'project_invitation_accepted',
    '邀請已接受',
    invitation.invitee_name + ' 已加入「' + invitation.project_title + '」',
    '/groups/' + invitation.project_id
  );

  res.json({
    invitation: Object.assign({}, invitation, {
      status: 'accepted',
      responded_at: new Date().toISOString()
    })
  });
}));

router.post('/invitations/:id/reject', auth.authRequired, asyncHandler(async function(req, res) {
  var invitation = await invitationById(req.params.id);
  if (!invitation) {
    res.status(404).json({ message: '找不到邀請' });
    return;
  }
  if (invitation.invitee_id !== req.user.student_id) {
    res.status(403).json({ message: '只能回覆自己的邀請' });
    return;
  }
  if (invitation.status !== 'pending') {
    res.status(400).json({ message: '此邀請已回覆' });
    return;
  }

  await db.run(
    'UPDATE project_invitations SET status = "rejected", responded_at = CURRENT_TIMESTAMP WHERE id = ?',
    [req.params.id]
  );
  await createNotification(
    invitation.inviter_id,
    'project_invitation_rejected',
    '邀請已拒絕',
    invitation.invitee_name + ' 已拒絕加入「' + invitation.project_title + '」',
    '/groups/' + invitation.project_id
  );

  res.json({ invitation: await invitationById(req.params.id) });
}));

router.post('/projects/:id/transfer-owner', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await manageableProjectForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  if (!project.can_transfer_leader) {
    res.status(403).json({ message: '只有隊長可以轉移隊長身份' });
    return;
  }
  if (!required(req.body.user_id)) {
    res.status(400).json({ message: '請選擇新隊長' });
    return;
  }

  var nextOwnerId = String(req.body.user_id).trim();
  if (nextOwnerId === project.owner_id) {
    res.status(400).json({ message: '新隊長不能是目前隊長' });
    return;
  }

  var member = await db.get(
      'SELECT applications.*, users.name AS member_name FROM applications ' +
      'JOIN users ON users.student_id = applications.user_id ' +
      'WHERE applications.project_id = ? AND applications.user_id = ? AND applications.status = "accepted"',
    [req.params.id, nextOwnerId]
  );
  if (!member) {
    res.status(400).json({ message: '只能轉移給目前專題成員' });
    return;
  }

  var oldOwnerMembership = await db.get(
    'SELECT id FROM applications WHERE project_id = ? AND user_id = ?',
    [req.params.id, project.owner_id]
  );
  if (oldOwnerMembership) {
    await db.run('UPDATE applications SET status = "accepted", role = "member" WHERE id = ?', [oldOwnerMembership.id]);
  } else {
    await db.run(
      'INSERT INTO applications (project_id, user_id, message, status, role) VALUES (?, ?, ?, "accepted", "member")',
      [req.params.id, project.owner_id, 'Former project owner']
    );
  }

  await db.run('UPDATE projects SET owner_id = ? WHERE id = ?', [nextOwnerId, req.params.id]);

  var memberIds = await db.all(
    'SELECT user_id FROM applications WHERE project_id = ? AND status = "accepted" ' +
      'UNION SELECT owner_id AS user_id FROM projects WHERE id = ?',
    [req.params.id, req.params.id]
  );
  await Promise.all(memberIds.map(function(row) {
    return createNotification(
      row.user_id,
      'project_owner_transferred',
      '隊長已轉移',
      '「' + project.title + '」的新隊長是 ' + member.member_name,
      '/groups/' + project.id
    );
  }));

  res.json({ project: await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]) });
}));

router.get('/groups/me', auth.authRequired, asyncHandler(async function(req, res) {
  var owned = await db.all(
    'SELECT projects.*, users.name AS owner_name, users.role AS owner_role, "owned" AS relation, "leader" AS group_role ' +
      'FROM projects JOIN users ON users.student_id = projects.owner_id ' +
      'WHERE projects.owner_id = ? ORDER BY projects.created_at DESC',
    [req.user.student_id]
  );
  var joined = await db.all(
    'SELECT projects.*, users.name AS owner_name, users.role AS owner_role, applications.created_at AS joined_at, "joined" AS relation, COALESCE(applications.role, "member") AS group_role ' +
      'FROM applications ' +
      'JOIN projects ON projects.id = applications.project_id ' +
      'JOIN users ON users.student_id = projects.owner_id ' +
      'WHERE applications.user_id = ? AND applications.status = "accepted" ' +
      'ORDER BY applications.created_at DESC',
    [req.user.student_id]
  );
  res.json({ owned: owned, joined: joined, all: owned.concat(joined) });
}));

router.get('/groups/:id', auth.authRequired, asyncHandler(async function(req, res) {
  var user = await currentUser(req.user.student_id);
  var project = await groupOrAdminForUser(req.params.id, req.user.student_id);
  if (!project) {
    project = await db.get(
      'SELECT projects.*, users.name AS owner_name, users.role AS owner_role, "public" AS relation, NULL AS group_role ' +
        'FROM projects JOIN users ON users.student_id = projects.owner_id WHERE projects.id = ?',
      [req.params.id]
    );
  }
  if (!project) {
    res.status(404).json({ message: '找不到群組' });
    return;
  }
  project.group_role = project.relation === 'admin'
    ? 'admin'
    : (project.group_role || await getGroupRole(req.params.id, req.user.student_id));
  project.can_manage = canManageGroup(project.group_role) || isAdminRole(user);
  project.can_transfer_leader = project.group_role === 'leader' || isAdminRole(user);
  project.can_delete_group = project.group_role === 'leader' || isAdminRole(user);
  project.can_view_private_area = ['owned', 'joined', 'admin'].indexOf(project.relation) >= 0;
  res.json({ group: project });
}));

router.get('/groups/:id/members', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!project) {
    res.status(404).json({ message: '找不到群組' });
    return;
  }

  var members = await db.all(
    'SELECT users.student_id AS id, users.student_id, users.name, users.username, users.email, users.role, "owned" AS relation, "leader" AS group_role, projects.created_at AS joined_at ' +
      'FROM projects JOIN users ON users.student_id = projects.owner_id ' +
      'WHERE projects.id = ? ' +
      'UNION ALL ' +
      'SELECT users.student_id AS id, users.student_id, users.name, users.username, users.email, users.role, "joined" AS relation, COALESCE(applications.role, "member") AS group_role, applications.created_at AS joined_at ' +
      'FROM applications JOIN users ON users.student_id = applications.user_id ' +
      'WHERE applications.project_id = ? AND applications.status = "accepted" AND users.student_id != ? ' +
      'UNION ALL ' +
      'SELECT users.student_id AS id, users.student_id, users.name, users.username, users.email, users.role, "invited" AS relation, "invited" AS group_role, project_invitations.created_at AS joined_at ' +
      'FROM project_invitations JOIN users ON users.student_id = project_invitations.invitee_id ' +
      'WHERE project_invitations.project_id = ? AND project_invitations.status = "pending" ' +
      'ORDER BY relation DESC, joined_at ASC',
    [req.params.id, req.params.id, project.owner_id, req.params.id]
  );
  res.json({ members: members });
}));

router.patch('/groups/:id/members/:memberId/role', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await manageableProjectForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  if (project.group_role !== 'leader') {
    res.status(403).json({ message: '只有隊長可以調整隊伍角色' });
    return;
  }

  var nextRole = req.body.role;
  if (nextRole !== 'vice_leader' && nextRole !== 'member') {
    res.status(400).json({ message: '隊伍角色只能是 vice_leader 或 member' });
    return;
  }

  var memberId = String(req.params.memberId).trim();
  if (memberId === project.owner_id) {
    res.status(400).json({ message: '隊長角色請透過轉移隊長調整' });
    return;
  }

  var updated = await db.run(
    'UPDATE applications SET role = ? WHERE project_id = ? AND user_id = ? AND status = "accepted"',
    [nextRole, req.params.id, memberId]
  );
  if (!updated.changes) {
    res.status(404).json({ message: '找不到此隊員' });
    return;
  }

  res.json({ member: await groupMemberById(req.params.id, memberId) });
}));

router.delete('/groups/:id/members/:memberId', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await manageableProjectForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  if (!project.can_manage) {
    res.status(403).json({ message: '只有隊長或管理員可以移除隊員' });
    return;
  }

  var memberId = String(req.params.memberId).trim();
  if (memberId === project.owner_id) {
    res.status(400).json({ message: '隊長不能把自己踢出隊伍' });
    return;
  }

  var membership = await db.get(
      'SELECT applications.*, users.name AS member_name FROM applications ' +
      'JOIN users ON users.student_id = applications.user_id ' +
      'WHERE applications.project_id = ? AND applications.user_id = ? AND applications.status = "accepted"',
    [req.params.id, memberId]
  );
  if (!membership) {
    res.status(404).json({ message: '找不到此隊員' });
    return;
  }
  if (project.group_role === 'vice_leader' && membership.role === 'vice_leader') {
    res.status(403).json({ message: '副隊長不能移除其他副隊長' });
    return;
  }

  await db.run('DELETE FROM applications WHERE id = ?', [membership.id]);
  await db.run(
    'UPDATE projects ' +
      'SET current_members = CASE WHEN current_members > 1 THEN current_members - 1 ELSE 1 END, ' +
      'status = CASE WHEN current_members - 1 < max_members THEN "open" ELSE status END ' +
      'WHERE id = ?',
    [req.params.id]
  );
  await createNotification(
    memberId,
    'project_member_removed',
    '已被移出隊伍',
    '你已被移出「' + project.title + '」',
    '/projects/' + project.id
  );

  res.json({ message: '隊員已移除', member_id: memberId });
}));

router.get('/groups/:id/comments', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await groupMemberForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到可存取的群組' });
    return;
  }

  var comments = await db.all(
    'SELECT comments.*, users.name AS user_name, users.role AS user_role FROM comments ' +
      'JOIN users ON users.student_id = comments.user_id ' +
      'WHERE project_id = ? ORDER BY comments.created_at DESC',
    [req.params.id]
  );
  res.json({ comments: comments });
}));

router.post('/groups/:id/comments', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await groupMemberForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到可存取的群組' });
    return;
  }
  if (!required(req.body.content)) {
    res.status(400).json({ message: '留言內容為必填' });
    return;
  }

  var result = await db.run(
    'INSERT INTO comments (project_id, user_id, content) VALUES (?, ?, ?)',
    [req.params.id, req.user.student_id, req.body.content]
  );
  res.status(201).json({ comment: await commentById(result.id) });
}));

router.get('/groups/:id/announcements', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await groupOrAdminForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到可存取的群組' });
    return;
  }

  var announcements = await db.all(
    'SELECT project_announcements.*, users.name AS author_name, users.role AS author_role ' +
      'FROM project_announcements JOIN users ON users.student_id = project_announcements.author_id ' +
      'WHERE project_announcements.project_id = ? ORDER BY project_announcements.created_at DESC',
    [req.params.id]
  );
  res.json({ announcements: announcements });
}));

router.post('/groups/:id/announcements', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await manageableProjectForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  if (!project.can_manage) {
    res.status(403).json({ message: '只有隊長或管理員可以管理公告' });
    return;
  }
  if (!required(req.body.content)) {
    res.status(400).json({ message: '公告內容為必填' });
    return;
  }

  var result = await db.run(
    'INSERT INTO project_announcements (project_id, author_id, content) VALUES (?, ?, ?)',
    [req.params.id, req.user.student_id, String(req.body.content).trim()]
  );
  res.status(201).json({ announcement: await announcementById(result.id) });
}));

router.put('/groups/:id/announcements/:announcementId', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await manageableProjectForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  if (!project.can_manage) {
    res.status(403).json({ message: '只有隊長或管理員可以管理公告' });
    return;
  }
  if (!required(req.body.content)) {
    res.status(400).json({ message: '公告內容為必填' });
    return;
  }

  var updated = await db.run(
    'UPDATE project_announcements SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND project_id = ?',
    [String(req.body.content).trim(), req.params.announcementId, req.params.id]
  );
  if (!updated.changes) {
    res.status(404).json({ message: '找不到公告' });
    return;
  }
  res.json({ announcement: await announcementById(req.params.announcementId) });
}));

router.delete('/groups/:id/announcements/:announcementId', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await manageableProjectForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  if (!project.can_manage) {
    res.status(403).json({ message: '只有隊長或管理員可以管理公告' });
    return;
  }

  var deleted = await db.run(
    'DELETE FROM project_announcements WHERE id = ? AND project_id = ?',
    [req.params.announcementId, req.params.id]
  );
  if (!deleted.changes) {
    res.status(404).json({ message: '找不到公告' });
    return;
  }
  res.json({ message: '公告已刪除' });
}));

function normalizedTargetTime(value) {
  if (!required(value)) {
    return null;
  }
  var date = new Date(String(value).trim());
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function canManageCountdown(project, countdown, userId) {
  return (
    countdown.created_by === userId ||
    canManageGroup(project.group_role) ||
    project.relation === 'admin'
  );
}

router.get('/groups/:id/countdowns', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await groupMemberForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到可存取的群組' });
    return;
  }

  var countdowns = await db.all(
    'SELECT group_countdowns.*, users.name AS creator_name, users.role AS creator_role ' +
      'FROM group_countdowns LEFT JOIN users ON users.student_id = group_countdowns.created_by ' +
      'WHERE group_countdowns.group_id = ? ORDER BY group_countdowns.target_time ASC, group_countdowns.created_at ASC',
    [req.params.id]
  );
  res.json({ countdowns: countdowns });
}));

router.post('/groups/:id/countdowns', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await groupMemberForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到可存取的群組' });
    return;
  }

  var targetTime = normalizedTargetTime(req.body.target_time);
  if (!required(req.body.title) || !targetTime) {
    res.status(400).json({ message: '倒數標題與有效目標時間為必填' });
    return;
  }

  var result = await db.run(
    'INSERT INTO group_countdowns (group_id, title, description, target_time, created_by) VALUES (?, ?, ?, ?, ?)',
    [
      req.params.id,
      String(req.body.title).trim(),
      req.body.description ? String(req.body.description).trim() : '',
      targetTime,
      req.user.student_id
    ]
  );
  res.status(201).json({ countdown: await countdownById(result.id) });
}));

router.patch('/groups/:id/countdowns/:countdownId', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await groupMemberForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到可存取的群組' });
    return;
  }

  var countdown = await countdownById(req.params.countdownId);
  if (!countdown || String(countdown.group_id) !== String(req.params.id)) {
    res.status(404).json({ message: '找不到倒數' });
    return;
  }
  if (!canManageCountdown(project, countdown, req.user.student_id)) {
    res.status(403).json({ message: '只有建立者、隊長或副隊長可以編輯倒數' });
    return;
  }

  var targetTime = normalizedTargetTime(req.body.target_time);
  if (!required(req.body.title) || !targetTime) {
    res.status(400).json({ message: '倒數標題與有效目標時間為必填' });
    return;
  }

  await db.run(
    'UPDATE group_countdowns SET title = ?, description = ?, target_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND group_id = ?',
    [
      String(req.body.title).trim(),
      req.body.description ? String(req.body.description).trim() : '',
      targetTime,
      req.params.countdownId,
      req.params.id
    ]
  );
  res.json({ countdown: await countdownById(req.params.countdownId) });
}));

router.delete('/groups/:id/countdowns/:countdownId', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await groupMemberForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到可存取的群組' });
    return;
  }

  var countdown = await countdownById(req.params.countdownId);
  if (!countdown || String(countdown.group_id) !== String(req.params.id)) {
    res.status(404).json({ message: '找不到倒數' });
    return;
  }
  if (!canManageCountdown(project, countdown, req.user.student_id)) {
    res.status(403).json({ message: '只有建立者、隊長或副隊長可以刪除倒數' });
    return;
  }

  await db.run('DELETE FROM group_countdowns WHERE id = ? AND group_id = ?', [req.params.countdownId, req.params.id]);
  res.json({ message: '倒數已刪除' });
}));

router.get('/groups/:id/deadlines', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await groupOrAdminForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到可存取的群組' });
    return;
  }

  var deadlines = await db.all(
    'SELECT * FROM project_deadlines WHERE project_id = ? ORDER BY deadline_date ASC, created_at ASC',
    [req.params.id]
  );
  res.json({ deadlines: deadlines });
}));

router.post('/groups/:id/deadlines', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await manageableProjectForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  if (!project.can_manage) {
    res.status(403).json({ message: '只有隊長或管理員可以管理倒數日期' });
    return;
  }
  if (!required(req.body.title) || !required(req.body.deadline_date)) {
    res.status(400).json({ message: '倒數標題與日期為必填' });
    return;
  }

  var result = await db.run(
    'INSERT INTO project_deadlines (project_id, title, deadline_date, description) VALUES (?, ?, ?, ?)',
    [
      req.params.id,
      String(req.body.title).trim(),
      String(req.body.deadline_date).trim(),
      req.body.description || ''
    ]
  );
  res.status(201).json({ deadline: await deadlineById(result.id) });
}));

router.put('/groups/:id/deadlines/:deadlineId', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await manageableProjectForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  if (!project.can_manage) {
    res.status(403).json({ message: '只有隊長或管理員可以管理倒數日期' });
    return;
  }
  if (!required(req.body.title) || !required(req.body.deadline_date)) {
    res.status(400).json({ message: '倒數標題與日期為必填' });
    return;
  }

  var updated = await db.run(
    'UPDATE project_deadlines SET title = ?, deadline_date = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND project_id = ?',
    [
      String(req.body.title).trim(),
      String(req.body.deadline_date).trim(),
      req.body.description || '',
      req.params.deadlineId,
      req.params.id
    ]
  );
  if (!updated.changes) {
    res.status(404).json({ message: '找不到倒數日期' });
    return;
  }
  res.json({ deadline: await deadlineById(req.params.deadlineId) });
}));

router.delete('/groups/:id/deadlines/:deadlineId', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await manageableProjectForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  if (!project.can_manage) {
    res.status(403).json({ message: '只有隊長或管理員可以管理倒數日期' });
    return;
  }

  var deleted = await db.run(
    'DELETE FROM project_deadlines WHERE id = ? AND project_id = ?',
    [req.params.deadlineId, req.params.id]
  );
  if (!deleted.changes) {
    res.status(404).json({ message: '找不到倒數日期' });
    return;
  }
  res.json({ message: '倒數日期已刪除' });
}));

router.get('/projects/:id', asyncHandler(async function(req, res) {
  var project = await db.get(
    'SELECT projects.*, users.name AS owner_name, users.role AS owner_role, users.email AS owner_email ' +
      'FROM projects JOIN users ON users.student_id = projects.owner_id WHERE projects.id = ?',
    [req.params.id]
  );
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  res.json({ project: project });
}));

router.post('/projects', auth.authRequired, asyncHandler(async function(req, res) {
  var body = req.body;
  if (!required(body.title) || !required(body.description) || !required(body.max_members)) {
    res.status(400).json({ message: '專題名稱、說明與人數上限為必填' });
    return;
  }

  var currentMembers = Number(body.current_members || 1);
  var maxMembers = Number(body.max_members);
  var status = projectStatusFromCapacity(currentMembers, maxMembers);

  var result = await db.run(
    'INSERT INTO projects (title, course_name, teacher_name, description, required_skills, current_members, max_members, status, accepting_applications, contact, owner_id) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      body.title,
      body.course_name || '',
      body.teacher_name || '',
      body.description,
      body.required_skills || '',
      currentMembers,
      maxMembers,
      status,
      boolToInt(body.accepting_applications, 1),
      body.contact || '',
      req.user.student_id
    ]
  );
  var project = await db.get('SELECT * FROM projects WHERE id = ?', [result.id]);
  res.status(201).json({ project: project });
}));

async function updateProjectDetails(req, res) {
  var project = await manageableProjectForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  if (!project.can_manage) {
    res.status(403).json({ message: '只有建立者或管理員可以編輯專題' });
    return;
  }

  var body = req.body;
  var currentMembers = Number(body.current_members || project.current_members);
  var maxMembers = Number(body.max_members || project.max_members);
  var status = projectStatusFromCapacity(currentMembers, maxMembers);

  await db.run(
    'UPDATE projects SET title = ?, course_name = ?, teacher_name = ?, description = ?, required_skills = ?, current_members = ?, max_members = ?, status = ?, accepting_applications = ?, contact = ? WHERE id = ?',
    [
      body.title || project.title,
      body.course_name || '',
      body.teacher_name || '',
      body.description || project.description,
      body.required_skills || '',
      currentMembers,
      maxMembers,
      status,
      boolToInt(body.accepting_applications, project.accepting_applications),
      body.contact || '',
      req.params.id
    ]
  );
  res.json({ project: await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]) });
}

router.put('/projects/:id', auth.authRequired, asyncHandler(updateProjectDetails));
router.patch('/groups/:id', auth.authRequired, asyncHandler(updateProjectDetails));

async function deleteProjectGroup(req, res) {
  var project = await manageableProjectForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  if (!project.can_delete_group) {
    res.status(403).json({ message: '只有隊長或管理員可以刪除專題' });
    return;
  }
  await db.run('DELETE FROM projects WHERE id = ?', [req.params.id]);
  res.json({ message: '專題已刪除' });
}

router.delete('/projects/:id', auth.authRequired, asyncHandler(deleteProjectGroup));
router.delete('/groups/:id', auth.authRequired, asyncHandler(deleteProjectGroup));

router.post('/projects/:id/apply', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  if (project.owner_id === req.user.student_id) {
    res.status(400).json({ message: '不能申請加入自己建立的專題' });
    return;
  }
  if (!project.accepting_applications) {
    res.status(400).json({ message: '此專題目前不開放申請' });
    return;
  }
  if (Number(project.current_members) >= Number(project.max_members)) {
    await db.run('UPDATE projects SET status = "full" WHERE id = ?', [req.params.id]);
    res.status(400).json({ message: '此專題已額滿' });
    return;
  }

  var result = await db.run(
    'INSERT INTO applications (project_id, user_id, message) VALUES (?, ?, ?)',
    [req.params.id, req.user.student_id, req.body.message || '']
  ).catch(function(err) {
    if (err.message.indexOf('UNIQUE') >= 0) {
      err.status = 409;
      err.publicMessage = '你已經申請過這個專題';
    }
    throw err;
  });
  res.status(201).json({ application: await applicationById(result.id) });
}));

router.get('/projects/:id/applications', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await manageableProjectForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  if (!project.can_manage) {
    res.status(403).json({ message: '只有建立者或管理員可以查看申請' });
    return;
  }
  var applications = await db.all(
    'SELECT applications.*, users.name AS applicant_name, users.role AS applicant_role, users.email AS applicant_email, users.skills AS applicant_skills ' +
      'FROM applications JOIN users ON users.student_id = applications.user_id ' +
      'WHERE project_id = ? AND applications.status = "pending" ORDER BY created_at DESC',
    [req.params.id]
  );
  res.json({ applications: applications });
}));

router.get('/my-applications', auth.authRequired, asyncHandler(async function(req, res) {
  var applications = await db.all(
    'SELECT applications.*, projects.title AS project_title, projects.status AS project_status ' +
      'FROM applications JOIN projects ON projects.id = applications.project_id ' +
      'WHERE applications.user_id = ? AND applications.status = "pending" ORDER BY applications.created_at DESC',
    [req.user.student_id]
  );
  res.json({ applications: applications });
}));

router.delete('/groups/:id/membership', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return;
  }
  if (project.owner_id === req.user.student_id) {
    res.status(400).json({ message: 'Owners should delete the project instead' });
    return;
  }

  var application = await db.get(
    'SELECT * FROM applications WHERE project_id = ? AND user_id = ? AND status IN ("pending", "accepted")',
    [req.params.id, req.user.student_id]
  );
  if (!application) {
    res.status(404).json({ message: 'Membership not found' });
    return;
  }

  await db.run('DELETE FROM applications WHERE id = ?', [application.id]);
  if (application.status === 'accepted') {
    await db.run(
      'UPDATE projects ' +
        'SET current_members = CASE WHEN current_members > 1 THEN current_members - 1 ELSE 1 END, ' +
        'status = CASE WHEN status = "full" AND current_members - 1 < max_members THEN "open" ELSE status END ' +
        'WHERE id = ?',
      [req.params.id]
    );
  }

  res.json({ message: 'Membership removed' });
}));
router.put('/applications/:id', auth.authRequired, asyncHandler(async function(req, res) {
  var application = await db.get(
    'SELECT applications.*, projects.owner_id, projects.current_members, projects.max_members FROM applications ' +
      'JOIN projects ON projects.id = applications.project_id WHERE applications.id = ?',
    [req.params.id]
  );
  if (!application) {
    res.status(404).json({ message: '找不到申請' });
    return;
  }
  var project = await manageableProjectForUser(application.project_id, req.user.student_id);
  if (!project || !project.can_manage) {
    res.status(403).json({ message: '只有專題建立者或管理員可以審核申請' });
    return;
  }
  if (VALID_APPLICATION_STATUS.indexOf(req.body.status) < 0) {
    res.status(400).json({ message: '申請狀態不正確' });
    return;
  }
  if (
    req.body.status === 'accepted' &&
    application.status !== 'accepted' &&
    Number(application.current_members) >= Number(application.max_members)
  ) {
    await db.run('UPDATE projects SET status = "full" WHERE id = ?', [application.project_id]);
    res.status(400).json({ message: '此專題已額滿' });
    return;
  }

  await db.run(
    'UPDATE applications SET status = ?, role = CASE WHEN ? = "accepted" THEN COALESCE(role, "member") ELSE role END WHERE id = ?',
    [req.body.status, req.body.status, req.params.id]
  );
  if (req.body.status === 'accepted' && application.status !== 'accepted') {
    await db.run(
      'UPDATE projects SET current_members = current_members + 1, status = CASE WHEN current_members + 1 >= max_members THEN "full" ELSE "open" END WHERE id = ?',
      [application.project_id]
    );
  }
  res.json({ application: await applicationById(req.params.id) });
}));

router.get('/projects/:id/comments', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await groupMemberForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到可存取的群組' });
    return;
  }

  var comments = await db.all(
    'SELECT comments.*, users.name AS user_name, users.role AS user_role FROM comments JOIN users ON users.student_id = comments.user_id WHERE project_id = ? ORDER BY comments.created_at DESC',
    [req.params.id]
  );
  res.json({ comments: comments });
}));

router.post('/projects/:id/comments', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await groupMemberForUser(req.params.id, req.user.student_id);
  if (!project) {
    res.status(404).json({ message: '找不到可存取的群組' });
    return;
  }
  if (!required(req.body.content)) {
    res.status(400).json({ message: '留言內容為必填' });
    return;
  }
  var result = await db.run(
    'INSERT INTO comments (project_id, user_id, content) VALUES (?, ?, ?)',
    [req.params.id, req.user.student_id, req.body.content]
  );
  res.status(201).json({ comment: await commentById(result.id) });
}));

router.delete('/comments/:id', auth.authRequired, asyncHandler(async function(req, res) {
  var comment = await db.get('SELECT * FROM comments WHERE id = ?', [req.params.id]);
  if (!comment) {
    res.status(404).json({ message: '找不到留言' });
    return;
  }
  var user = await currentUser(req.user.student_id);
  if (comment.user_id !== req.user.student_id && !isAdminRole(user)) {
    res.status(403).json({ message: '只能刪除自己的留言或由管理員刪除' });
    return;
  }
  await db.run('DELETE FROM comments WHERE id = ?', [req.params.id]);
  res.json({ message: '留言已刪除' });
}));

function applicationById(id) {
  return db.get(
      'SELECT applications.*, users.name AS applicant_name, users.role AS applicant_role, projects.title AS project_title FROM applications ' +
      'JOIN users ON users.student_id = applications.user_id JOIN projects ON projects.id = applications.project_id WHERE applications.id = ?',
    [id]
  );
}

function invitationById(id) {
  return db.get(
    'SELECT project_invitations.*, projects.title AS project_title, projects.status AS project_status, ' +
      'inviter.name AS inviter_name, inviter.role AS inviter_role, ' +
      'invitee.name AS invitee_name, invitee.role AS invitee_role ' +
      'FROM project_invitations ' +
      'JOIN projects ON projects.id = project_invitations.project_id ' +
      'JOIN users AS inviter ON inviter.student_id = project_invitations.inviter_id ' +
      'JOIN users AS invitee ON invitee.student_id = project_invitations.invitee_id ' +
      'WHERE project_invitations.id = ?',
    [id]
  );
}

function commentById(id) {
  return db.get(
    'SELECT comments.*, users.name AS user_name, users.role AS user_role FROM comments JOIN users ON users.student_id = comments.user_id WHERE comments.id = ?',
    [id]
  );
}

function announcementById(id) {
  return db.get(
      'SELECT project_announcements.*, users.name AS author_name, users.role AS author_role ' +
      'FROM project_announcements JOIN users ON users.student_id = project_announcements.author_id ' +
      'WHERE project_announcements.id = ?',
    [id]
  );
}

function deadlineById(id) {
  return db.get('SELECT * FROM project_deadlines WHERE id = ?', [id]);
}

function countdownById(id) {
  return db.get(
    'SELECT group_countdowns.*, users.name AS creator_name, users.role AS creator_role ' +
      'FROM group_countdowns LEFT JOIN users ON users.student_id = group_countdowns.created_by ' +
      'WHERE group_countdowns.id = ?',
    [id]
  );
}

function reportSelectSql(suffix) {
  return (
    'SELECT reports.*, ' +
      'reporter.name AS reporter_name, reporter.email AS reporter_email, reporter.role AS reporter_role, ' +
      'target.name AS target_user_name, target.email AS target_user_email, target.role AS target_user_role, ' +
      'projects.title AS project_title, comments.content AS comment_content, ' +
      'handler.name AS handled_by_name ' +
    'FROM reports ' +
    'JOIN users AS reporter ON reporter.student_id = reports.reporter_id ' +
    'LEFT JOIN users AS target ON target.student_id = reports.target_user_id ' +
    'LEFT JOIN projects ON projects.id = reports.target_project_id ' +
    'LEFT JOIN comments ON comments.id = reports.target_comment_id ' +
    'LEFT JOIN users AS handler ON handler.student_id = reports.handled_by ' +
    (suffix || '')
  );
}

function reportById(id) {
  return db.get(reportSelectSql('WHERE reports.id = ?'), [id]);
}

function groupForUser(projectId, userId) {
  return db.get(
    'SELECT projects.*, users.name AS owner_name, users.role AS owner_role, ' +
      'CASE ' +
        'WHEN projects.owner_id = ? THEN "owned" ' +
        'WHEN applications.status = "accepted" THEN "joined" ' +
        'WHEN applications.status = "pending" THEN "pending" ' +
      'END AS relation, ' +
      'CASE ' +
        'WHEN projects.owner_id = ? THEN "leader" ' +
        'WHEN applications.status = "accepted" THEN COALESCE(applications.role, "member") ' +
        'ELSE NULL ' +
      'END AS group_role ' +
      'FROM projects JOIN users ON users.student_id = projects.owner_id ' +
      'LEFT JOIN applications ON applications.project_id = projects.id AND applications.user_id = ? ' +
      'WHERE projects.id = ? AND (' +
        'projects.owner_id = ? OR applications.status IN ("accepted", "pending")' +
      ')',
    [userId, userId, userId, projectId, userId]
  );
}

async function groupMemberForUser(projectId, userId) {
  var user = await currentUser(userId);
  var memberProject = await db.get(
    'SELECT projects.*, users.name AS owner_name, users.role AS owner_role, ' +
      'CASE WHEN projects.owner_id = ? THEN "owned" ELSE "joined" END AS relation, ' +
      'CASE WHEN projects.owner_id = ? THEN "leader" ELSE COALESCE((' +
        'SELECT role FROM applications ' +
        'WHERE applications.project_id = projects.id ' +
        'AND applications.user_id = ? ' +
        'AND applications.status = "accepted"' +
      '), "member") END AS group_role ' +
      'FROM projects JOIN users ON users.student_id = projects.owner_id ' +
      'WHERE projects.id = ? AND (' +
        'projects.owner_id = ? OR EXISTS (' +
          'SELECT 1 FROM applications ' +
          'WHERE applications.project_id = projects.id ' +
          'AND applications.user_id = ? ' +
          'AND applications.status = "accepted"' +
        ')' +
      ')',
    [userId, userId, userId, projectId, userId, userId]
  );
  if (memberProject) {
    return memberProject;
  }

  if (isAdminRole(user)) {
    return db.get(
      'SELECT projects.*, users.name AS owner_name, users.role AS owner_role, "admin" AS relation, "admin" AS group_role ' +
        'FROM projects JOIN users ON users.student_id = projects.owner_id WHERE projects.id = ?',
      [projectId]
    );
  }

  return null;
}

router.use(function(err, req, res, next) {
  if (err.publicMessage) {
    res.status(err.status || 400).json({ message: err.publicMessage });
    return;
  }
  console.error(err);
  res.status(err.status || 500).json({ message: '伺服器發生錯誤' });
});

module.exports = router;
