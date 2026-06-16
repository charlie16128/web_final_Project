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
    id: row.id,
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

async function createNotification(userId, type, title, content, link) {
  if (!userId) {
    return;
  }
  await db.run(
    'INSERT INTO notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)',
    [userId, type, title, content || '', link || '']
  );
}

async function currentUser(userId) {
  return db.get('SELECT * FROM users WHERE id = ?', [userId]);
}

async function groupOrAdminForUser(projectId, userId) {
  var user = await currentUser(userId);
  if (!user) {
    return null;
  }

  if (isAdminRole(user)) {
    var adminProject = await db.get(
      'SELECT projects.*, users.name AS owner_name, users.role AS owner_role, "admin" AS relation ' +
        'FROM projects JOIN users ON users.id = projects.owner_id WHERE projects.id = ?',
      [projectId]
    );
    return adminProject || null;
  }

  return groupForUser(projectId, userId);
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

  project.can_manage = project.owner_id === user.id || isAdminRole(user);
  return project;
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

  var exists = await db.get('SELECT id FROM users WHERE email = ?', [body.email]);
  if (exists) {
    res.status(409).json({ message: 'Email 已被使用' });
    return;
  }

  exists = await db.get('SELECT id FROM users WHERE student_id = ?', [body.student_id]);
  if (exists) {
    res.status(409).json({ message: '學號已被使用' });
    return;
  }

  var hash = await bcrypt.hash(body.password, 10);
  var result = await db.run(
    'INSERT INTO users (username, name, student_id, email, password, role) VALUES (?, ?, ?, ?, ?, ?)',
    [body.name, body.name, body.student_id, body.email, hash, 'user']
  );
  var user = await db.get('SELECT * FROM users WHERE id = ?', [result.id]);
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
  var user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) {
    res.status(401).json({ message: '登入狀態已失效，請重新登入' });
    return;
  }
  res.json({ user: publicUser(user) });
}));

router.put('/users/me', auth.authRequired, asyncHandler(async function(req, res) {
  var body = req.body;
  var currentUser = await db.get('SELECT id FROM users WHERE id = ?', [req.user.id]);
  if (!currentUser) {
    res.status(401).json({ message: '登入狀態已失效，請重新登入' });
    return;
  }

  if (!required(body.email)) {
    res.status(400).json({ message: 'Email 為必填' });
    return;
  }

  var email = String(body.email).trim();
  var exists = await db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.user.id]);
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
    await db.run('UPDATE users SET email = ?, password = ? WHERE id = ?', [email, hash, req.user.id]);
  } else {
    await db.run('UPDATE users SET email = ? WHERE id = ?', [email, req.user.id]);
  }

  var user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: publicUser(user) });
}));

router.get('/projects', auth.optionalAuth, asyncHandler(async function(req, res) {
  var userId = req.user ? req.user.id : null;
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
      'FROM projects JOIN users ON users.id = projects.owner_id ' +
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
    [req.user.id, req.params.id]
  );
  res.json({ favorited: true });
}));

router.delete('/projects/:id/favorite', auth.authRequired, asyncHandler(async function(req, res) {
  await db.run(
    'DELETE FROM project_favorites WHERE user_id = ? AND project_id = ?',
    [req.user.id, req.params.id]
  );
  res.json({ favorited: false });
}));

router.post('/projects/:id/invitations', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await syncProjectCapacity(req.params.id);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  if (project.owner_id !== req.user.id) {
    res.status(403).json({ message: '只有隊長可以邀請成員' });
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

  var inviteeId = Number(req.body.user_id);
  if (inviteeId === req.user.id) {
    res.status(400).json({ message: '不能邀請自己' });
    return;
  }

  var invitee = await db.get('SELECT id, name FROM users WHERE id = ?', [inviteeId]);
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

  var result = await db.run(
    'INSERT INTO project_invitations (project_id, inviter_id, invitee_id, message) VALUES (?, ?, ?, ?)',
    [req.params.id, req.user.id, inviteeId, req.body.message || '']
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
}));

router.get('/me/invitations', auth.authRequired, asyncHandler(async function(req, res) {
  var invitations = await db.all(
    'SELECT project_invitations.*, projects.title AS project_title, projects.status AS project_status, ' +
      'users.name AS inviter_name, users.role AS inviter_role ' +
      'FROM project_invitations ' +
      'JOIN projects ON projects.id = project_invitations.project_id ' +
      'JOIN users ON users.id = project_invitations.inviter_id ' +
      'WHERE project_invitations.invitee_id = ? AND project_invitations.status = "pending" ' +
      'ORDER BY project_invitations.created_at DESC',
    [req.user.id]
  );
  res.json({ invitations: invitations });
}));

router.post('/invitations/:id/accept', auth.authRequired, asyncHandler(async function(req, res) {
  var invitation = await invitationById(req.params.id);
  if (!invitation) {
    res.status(404).json({ message: '找不到邀請' });
    return;
  }
  if (invitation.invitee_id !== req.user.id) {
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
    [invitation.project_id, req.user.id]
  );
  if (existingApplication && existingApplication.status === 'accepted') {
    res.status(409).json({ message: '你已經是專題成員' });
    return;
  }

  if (existingApplication) {
    await db.run('UPDATE applications SET status = "accepted" WHERE id = ?', [existingApplication.id]);
  } else {
    await db.run(
      'INSERT INTO applications (project_id, user_id, message, status) VALUES (?, ?, ?, "accepted")',
      [invitation.project_id, req.user.id, invitation.message || '']
    );
  }

  await db.run(
    'UPDATE projects SET current_members = current_members + 1, status = CASE WHEN current_members + 1 >= max_members THEN "full" ELSE "open" END WHERE id = ?',
    [invitation.project_id]
  );
  await db.run(
    'UPDATE project_invitations SET status = "accepted", responded_at = CURRENT_TIMESTAMP WHERE id = ?',
    [req.params.id]
  );
  await createNotification(
    invitation.inviter_id,
    'project_invitation_accepted',
    '邀請已接受',
    invitation.invitee_name + ' 已加入「' + invitation.project_title + '」',
    '/groups/' + invitation.project_id
  );

  res.json({ invitation: await invitationById(req.params.id) });
}));

router.post('/invitations/:id/reject', auth.authRequired, asyncHandler(async function(req, res) {
  var invitation = await invitationById(req.params.id);
  if (!invitation) {
    res.status(404).json({ message: '找不到邀請' });
    return;
  }
  if (invitation.invitee_id !== req.user.id) {
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
  var project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  if (project.owner_id !== req.user.id) {
    res.status(403).json({ message: '只有隊長可以轉移隊長身份' });
    return;
  }
  if (!required(req.body.user_id)) {
    res.status(400).json({ message: '請選擇新隊長' });
    return;
  }

  var nextOwnerId = Number(req.body.user_id);
  if (nextOwnerId === req.user.id) {
    res.status(400).json({ message: '新隊長不能是目前隊長' });
    return;
  }

  var member = await db.get(
    'SELECT applications.*, users.name AS member_name FROM applications ' +
      'JOIN users ON users.id = applications.user_id ' +
      'WHERE applications.project_id = ? AND applications.user_id = ? AND applications.status = "accepted"',
    [req.params.id, nextOwnerId]
  );
  if (!member) {
    res.status(400).json({ message: '只能轉移給目前專題成員' });
    return;
  }

  var oldOwnerMembership = await db.get(
    'SELECT id FROM applications WHERE project_id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  if (oldOwnerMembership) {
    await db.run('UPDATE applications SET status = "accepted" WHERE id = ?', [oldOwnerMembership.id]);
  } else {
    await db.run(
      'INSERT INTO applications (project_id, user_id, message, status) VALUES (?, ?, ?, "accepted")',
      [req.params.id, req.user.id, 'Former project owner']
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
    'SELECT projects.*, users.name AS owner_name, users.role AS owner_role, "owned" AS relation ' +
      'FROM projects JOIN users ON users.id = projects.owner_id ' +
      'WHERE projects.owner_id = ? ORDER BY projects.created_at DESC',
    [req.user.id]
  );
  var joined = await db.all(
    'SELECT projects.*, users.name AS owner_name, users.role AS owner_role, applications.created_at AS joined_at, "joined" AS relation ' +
      'FROM applications ' +
      'JOIN projects ON projects.id = applications.project_id ' +
      'JOIN users ON users.id = projects.owner_id ' +
      'WHERE applications.user_id = ? AND applications.status = "accepted" ' +
      'ORDER BY applications.created_at DESC',
    [req.user.id]
  );
  res.json({ owned: owned, joined: joined, all: owned.concat(joined) });
}));

router.get('/groups/:id', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await groupForUser(req.params.id, req.user.id);
  if (!project) {
    res.status(404).json({ message: '找不到可存取的群組' });
    return;
  }
  res.json({ group: project });
}));

router.get('/groups/:id/members', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await groupMemberForUser(req.params.id, req.user.id);
  if (!project) {
    res.status(404).json({ message: '找不到可存取的群組' });
    return;
  }

  var members = await db.all(
    'SELECT users.id, users.name, users.username, users.email, users.role, "owned" AS relation, projects.created_at AS joined_at ' +
      'FROM projects JOIN users ON users.id = projects.owner_id ' +
      'WHERE projects.id = ? ' +
      'UNION ALL ' +
      'SELECT users.id, users.name, users.username, users.email, users.role, "joined" AS relation, applications.created_at AS joined_at ' +
      'FROM applications JOIN users ON users.id = applications.user_id ' +
      'WHERE applications.project_id = ? AND applications.status = "accepted" AND users.id != ? ' +
      'ORDER BY relation DESC, joined_at ASC',
    [req.params.id, req.params.id, project.owner_id]
  );
  res.json({ members: members });
}));

router.delete('/groups/:id/members/:memberId', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  if (project.owner_id !== req.user.id) {
    res.status(403).json({ message: '只有隊長可以移除隊員' });
    return;
  }

  var memberId = Number(req.params.memberId);
  if (memberId === project.owner_id) {
    res.status(400).json({ message: '隊長不能把自己踢出隊伍' });
    return;
  }

  var membership = await db.get(
    'SELECT applications.*, users.name AS member_name FROM applications ' +
      'JOIN users ON users.id = applications.user_id ' +
      'WHERE applications.project_id = ? AND applications.user_id = ? AND applications.status = "accepted"',
    [req.params.id, memberId]
  );
  if (!membership) {
    res.status(404).json({ message: '找不到此隊員' });
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
  var project = await groupMemberForUser(req.params.id, req.user.id);
  if (!project) {
    res.status(404).json({ message: '找不到可存取的群組' });
    return;
  }

  var comments = await db.all(
    'SELECT comments.*, users.name AS user_name, users.role AS user_role FROM comments ' +
      'JOIN users ON users.id = comments.user_id ' +
      'WHERE project_id = ? ORDER BY comments.created_at ASC',
    [req.params.id]
  );
  res.json({ comments: comments });
}));

router.post('/groups/:id/comments', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await groupMemberForUser(req.params.id, req.user.id);
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
    [req.params.id, req.user.id, req.body.content]
  );
  res.status(201).json({ comment: await commentById(result.id) });
}));

router.get('/groups/:id/announcements', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await groupOrAdminForUser(req.params.id, req.user.id);
  if (!project) {
    res.status(404).json({ message: '找不到可存取的群組' });
    return;
  }

  var announcements = await db.all(
    'SELECT project_announcements.*, users.name AS author_name, users.role AS author_role ' +
      'FROM project_announcements JOIN users ON users.id = project_announcements.author_id ' +
      'WHERE project_announcements.project_id = ? ORDER BY project_announcements.created_at DESC',
    [req.params.id]
  );
  res.json({ announcements: announcements });
}));

router.post('/groups/:id/announcements', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await manageableProjectForUser(req.params.id, req.user.id);
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
    [req.params.id, req.user.id, String(req.body.content).trim()]
  );
  res.status(201).json({ announcement: await announcementById(result.id) });
}));

router.put('/groups/:id/announcements/:announcementId', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await manageableProjectForUser(req.params.id, req.user.id);
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
  var project = await manageableProjectForUser(req.params.id, req.user.id);
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

router.get('/groups/:id/deadlines', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await groupOrAdminForUser(req.params.id, req.user.id);
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
  var project = await manageableProjectForUser(req.params.id, req.user.id);
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
  var project = await manageableProjectForUser(req.params.id, req.user.id);
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
  var project = await manageableProjectForUser(req.params.id, req.user.id);
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
      'FROM projects JOIN users ON users.id = projects.owner_id WHERE projects.id = ?',
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
      req.user.id
    ]
  );
  var project = await db.get('SELECT * FROM projects WHERE id = ?', [result.id]);
  res.status(201).json({ project: project });
}));

router.put('/projects/:id', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  if (project.owner_id !== req.user.id) {
    res.status(403).json({ message: '只有建立者可以編輯專題' });
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
}));

router.delete('/projects/:id', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  if (project.owner_id !== req.user.id) {
    res.status(403).json({ message: '只有建立者可以刪除專題' });
    return;
  }
  await db.run('DELETE FROM projects WHERE id = ?', [req.params.id]);
  res.json({ message: '專題已刪除' });
}));

router.post('/projects/:id/apply', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  if (project.owner_id === req.user.id) {
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
    [req.params.id, req.user.id, req.body.message || '']
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
  var project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  if (project.owner_id !== req.user.id) {
    res.status(403).json({ message: '只有建立者可以查看申請' });
    return;
  }
  var applications = await db.all(
    'SELECT applications.*, users.name AS applicant_name, users.role AS applicant_role, users.email AS applicant_email, users.skills AS applicant_skills ' +
      'FROM applications JOIN users ON users.id = applications.user_id ' +
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
    [req.user.id]
  );
  res.json({ applications: applications });
}));

router.delete('/groups/:id/membership', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return;
  }
  if (project.owner_id === req.user.id) {
    res.status(400).json({ message: 'Owners should delete the project instead' });
    return;
  }

  var application = await db.get(
    'SELECT * FROM applications WHERE project_id = ? AND user_id = ? AND status IN ("pending", "accepted")',
    [req.params.id, req.user.id]
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
  if (application.owner_id !== req.user.id) {
    res.status(403).json({ message: '只有專題建立者可以審核申請' });
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

  await db.run('UPDATE applications SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
  if (req.body.status === 'accepted' && application.status !== 'accepted') {
    await db.run(
      'UPDATE projects SET current_members = current_members + 1, status = CASE WHEN current_members + 1 >= max_members THEN "full" ELSE "open" END WHERE id = ?',
      [application.project_id]
    );
  }
  res.json({ application: await applicationById(req.params.id) });
}));

router.get('/projects/:id/comments', asyncHandler(async function(req, res) {
  var comments = await db.all(
    'SELECT comments.*, users.name AS user_name, users.role AS user_role FROM comments JOIN users ON users.id = comments.user_id WHERE project_id = ? ORDER BY comments.created_at ASC',
    [req.params.id]
  );
  res.json({ comments: comments });
}));

router.post('/projects/:id/comments', auth.authRequired, asyncHandler(async function(req, res) {
  if (!required(req.body.content)) {
    res.status(400).json({ message: '留言內容為必填' });
    return;
  }
  var project = await db.get('SELECT id FROM projects WHERE id = ?', [req.params.id]);
  if (!project) {
    res.status(404).json({ message: '找不到專題' });
    return;
  }
  var result = await db.run(
    'INSERT INTO comments (project_id, user_id, content) VALUES (?, ?, ?)',
    [req.params.id, req.user.id, req.body.content]
  );
  res.status(201).json({ comment: await commentById(result.id) });
}));

router.delete('/comments/:id', auth.authRequired, asyncHandler(async function(req, res) {
  var comment = await db.get('SELECT * FROM comments WHERE id = ?', [req.params.id]);
  if (!comment) {
    res.status(404).json({ message: '找不到留言' });
    return;
  }
  if (comment.user_id !== req.user.id) {
    res.status(403).json({ message: '只能刪除自己的留言' });
    return;
  }
  await db.run('DELETE FROM comments WHERE id = ?', [req.params.id]);
  res.json({ message: '留言已刪除' });
}));

function applicationById(id) {
  return db.get(
    'SELECT applications.*, users.name AS applicant_name, users.role AS applicant_role, projects.title AS project_title FROM applications ' +
      'JOIN users ON users.id = applications.user_id JOIN projects ON projects.id = applications.project_id WHERE applications.id = ?',
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
      'JOIN users AS inviter ON inviter.id = project_invitations.inviter_id ' +
      'JOIN users AS invitee ON invitee.id = project_invitations.invitee_id ' +
      'WHERE project_invitations.id = ?',
    [id]
  );
}

function commentById(id) {
  return db.get(
    'SELECT comments.*, users.name AS user_name, users.role AS user_role FROM comments JOIN users ON users.id = comments.user_id WHERE comments.id = ?',
    [id]
  );
}

function announcementById(id) {
  return db.get(
    'SELECT project_announcements.*, users.name AS author_name, users.role AS author_role ' +
      'FROM project_announcements JOIN users ON users.id = project_announcements.author_id ' +
      'WHERE project_announcements.id = ?',
    [id]
  );
}

function deadlineById(id) {
  return db.get('SELECT * FROM project_deadlines WHERE id = ?', [id]);
}

function groupForUser(projectId, userId) {
  return db.get(
    'SELECT projects.*, users.name AS owner_name, users.role AS owner_role, ' +
      'CASE ' +
        'WHEN projects.owner_id = ? THEN "owned" ' +
        'WHEN applications.status = "accepted" THEN "joined" ' +
        'WHEN applications.status = "pending" THEN "pending" ' +
      'END AS relation ' +
      'FROM projects JOIN users ON users.id = projects.owner_id ' +
      'LEFT JOIN applications ON applications.project_id = projects.id AND applications.user_id = ? ' +
      'WHERE projects.id = ? AND (' +
        'projects.owner_id = ? OR applications.status IN ("accepted", "pending")' +
      ')',
    [userId, userId, projectId, userId]
  );
}

function groupMemberForUser(projectId, userId) {
  return db.get(
    'SELECT projects.*, users.name AS owner_name, users.role AS owner_role, ' +
      'CASE WHEN projects.owner_id = ? THEN "owned" ELSE "joined" END AS relation ' +
      'FROM projects JOIN users ON users.id = projects.owner_id ' +
      'WHERE projects.id = ? AND (' +
        'projects.owner_id = ? OR EXISTS (' +
          'SELECT 1 FROM applications ' +
          'WHERE applications.project_id = projects.id ' +
          'AND applications.user_id = ? ' +
          'AND applications.status = "accepted"' +
        ')' +
      ')',
    [userId, projectId, userId, userId]
  );
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
