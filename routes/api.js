var express = require('express');
var bcrypt = require('bcrypt');
var db = require('../database/db');
var auth = require('../middleware/auth');

var router = express.Router();
var VALID_APPLICATION_STATUS = ['pending', 'accepted', 'rejected'];
var VALID_PROJECT_STATUS = ['open', 'full', 'closed'];

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
    name: row.name,
    student_id: row.student_id,
    email: row.email,
    created_at: row.created_at
  };
}

function boolToInt(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return value === true || value === 'true' || value === 1 || value === '1' ? 1 : 0;
}

router.post('/register', asyncHandler(async function(req, res) {
  var body = req.body;
  if (!required(body.name) || !required(body.student_id) || !required(body.email) || !required(body.password)) {
    res.status(400).json({ message: '姓名、學號、Email、密碼皆為必填' });
    return;
  }

  if (!/^D[0-9]{7}$/.test(body.student_id)) {
    res.status(400).json({ message: '學號格式需為 D 加 7 個數字，共 8 個字元' });
    return;
  }

  if (!/^[A-Za-z0-9]{6,}$/.test(body.password)) {
    res.status(400).json({ message: '密碼至少 6 位，且只能使用英文字母與數字' });
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
    'INSERT INTO users (name, student_id, email, password) VALUES (?, ?, ?, ?)',
    [body.name, body.student_id, body.email, hash]
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
  var rows = await db.all(
    'SELECT projects.*, users.name AS owner_name ' +
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
      'ORDER BY projects.created_at DESC',
    [
      req.query.status || null,
      req.query.status || null,
      req.query.q || null,
      '%' + (req.query.q || '') + '%',
      '%' + (req.query.q || '') + '%',
      '%' + (req.query.q || '') + '%',
      userId,
      userId,
      userId,
      userId
    ]
  );
  res.json({ projects: rows });
}));

router.get('/groups/me', auth.authRequired, asyncHandler(async function(req, res) {
  var owned = await db.all(
    'SELECT projects.*, users.name AS owner_name, "owned" AS relation ' +
      'FROM projects JOIN users ON users.id = projects.owner_id ' +
      'WHERE projects.owner_id = ? ORDER BY projects.created_at DESC',
    [req.user.id]
  );
  var joined = await db.all(
    'SELECT projects.*, users.name AS owner_name, applications.created_at AS joined_at, "joined" AS relation ' +
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
    res.status(404).json({ message: '找不到群組，或你尚未加入這個群組' });
    return;
  }
  res.json({ group: project });
}));

router.get('/groups/:id/comments', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await groupForUser(req.params.id, req.user.id);
  if (!project) {
    res.status(404).json({ message: '找不到群組，或你尚未加入這個群組' });
    return;
  }

  var comments = await db.all(
    'SELECT comments.*, users.name AS user_name FROM comments ' +
      'JOIN users ON users.id = comments.user_id ' +
      'WHERE project_id = ? ORDER BY comments.created_at ASC',
    [req.params.id]
  );
  res.json({ comments: comments });
}));

router.post('/groups/:id/comments', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await groupForUser(req.params.id, req.user.id);
  if (!project) {
    res.status(404).json({ message: '找不到群組，或你尚未加入這個群組' });
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

router.get('/projects/:id', asyncHandler(async function(req, res) {
  var project = await db.get(
    'SELECT projects.*, users.name AS owner_name, users.email AS owner_email ' +
      'FROM projects JOIN users ON users.id = projects.owner_id WHERE projects.id = ?',
    [req.params.id]
  );
  if (!project) {
    res.status(404).json({ message: '找不到專案' });
    return;
  }
  res.json({ project: project });
}));

router.post('/projects', auth.authRequired, asyncHandler(async function(req, res) {
  var body = req.body;
  if (!required(body.title) || !required(body.description) || !required(body.max_members)) {
    res.status(400).json({ message: '專案名稱、描述、徵求人數為必填' });
    return;
  }

  var result = await db.run(
    'INSERT INTO projects (title, course_name, teacher_name, description, required_skills, current_members, max_members, status, accepting_applications, contact, owner_id) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      body.title,
      body.course_name || '',
      body.teacher_name || '',
      body.description,
      body.required_skills || '',
      Number(body.current_members || 1),
      Number(body.max_members),
      VALID_PROJECT_STATUS.indexOf(body.status) >= 0 ? body.status : 'open',
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
    res.status(404).json({ message: '找不到專案' });
    return;
  }
  if (project.owner_id !== req.user.id) {
    res.status(403).json({ message: '只有建立者可以編輯專案' });
    return;
  }

  var body = req.body;
  await db.run(
    'UPDATE projects SET title = ?, course_name = ?, teacher_name = ?, description = ?, required_skills = ?, current_members = ?, max_members = ?, status = ?, accepting_applications = ?, contact = ? WHERE id = ?',
    [
      body.title || project.title,
      body.course_name || '',
      body.teacher_name || '',
      body.description || project.description,
      body.required_skills || '',
      Number(body.current_members || project.current_members),
      Number(body.max_members || project.max_members),
      VALID_PROJECT_STATUS.indexOf(body.status) >= 0 ? body.status : project.status,
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
    res.status(404).json({ message: '找不到專案' });
    return;
  }
  if (project.owner_id !== req.user.id) {
    res.status(403).json({ message: '只有建立者可以刪除專案' });
    return;
  }
  await db.run('DELETE FROM projects WHERE id = ?', [req.params.id]);
  res.json({ message: '專案已刪除' });
}));

router.post('/projects/:id/apply', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!project) {
    res.status(404).json({ message: '找不到專案' });
    return;
  }
  if (project.owner_id === req.user.id) {
    res.status(400).json({ message: '不能申請自己建立的專案' });
    return;
  }
  if (!project.accepting_applications || project.status !== 'open') {
    res.status(400).json({ message: '此專案目前暫停接受申請' });
    return;
  }

  var result = await db.run(
    'INSERT INTO applications (project_id, user_id, message) VALUES (?, ?, ?)',
    [req.params.id, req.user.id, req.body.message || '']
  ).catch(function(err) {
    if (err.message.indexOf('UNIQUE') >= 0) {
      err.status = 409;
      err.publicMessage = '你已經申請過這個專案';
    }
    throw err;
  });
  res.status(201).json({ application: await applicationById(result.id) });
}));

router.get('/projects/:id/applications', auth.authRequired, asyncHandler(async function(req, res) {
  var project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!project) {
    res.status(404).json({ message: '找不到專案' });
    return;
  }
  if (project.owner_id !== req.user.id) {
    res.status(403).json({ message: '只有建立者可以查看申請' });
    return;
  }
  var applications = await db.all(
    'SELECT applications.*, users.name AS applicant_name, users.email AS applicant_email, users.skills AS applicant_skills ' +
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
      'WHERE applications.user_id = ? ORDER BY applications.created_at DESC',
    [req.user.id]
  );
  res.json({ applications: applications });
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
    res.status(403).json({ message: '只有專案建立者可以更新申請狀態' });
    return;
  }
  if (VALID_APPLICATION_STATUS.indexOf(req.body.status) < 0) {
    res.status(400).json({ message: '申請狀態不正確' });
    return;
  }

  await db.run('UPDATE applications SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
  if (req.body.status === 'accepted' && application.status !== 'accepted') {
    await db.run(
      'UPDATE projects SET current_members = current_members + 1, status = CASE WHEN current_members + 1 >= max_members THEN "full" ELSE status END WHERE id = ?',
      [application.project_id]
    );
  }
  res.json({ application: await applicationById(req.params.id) });
}));

router.get('/projects/:id/comments', asyncHandler(async function(req, res) {
  var comments = await db.all(
    'SELECT comments.*, users.name AS user_name FROM comments JOIN users ON users.id = comments.user_id WHERE project_id = ? ORDER BY comments.created_at ASC',
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
    res.status(404).json({ message: '找不到專案' });
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
    'SELECT applications.*, users.name AS applicant_name, projects.title AS project_title FROM applications ' +
      'JOIN users ON users.id = applications.user_id JOIN projects ON projects.id = applications.project_id WHERE applications.id = ?',
    [id]
  );
}

function commentById(id) {
  return db.get(
    'SELECT comments.*, users.name AS user_name FROM comments JOIN users ON users.id = comments.user_id WHERE comments.id = ?',
    [id]
  );
}

function groupForUser(projectId, userId) {
  return db.get(
    'SELECT projects.*, users.name AS owner_name, ' +
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
