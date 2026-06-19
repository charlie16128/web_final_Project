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
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamup-phase-two-'));
  var previousDbPath = process.env.TEAMUP_DB_PATH;
  var previousJwtSecret = process.env.JWT_SECRET;
  process.env.TEAMUP_DB_PATH = path.join(tempDir, 'test.sqlite');
  process.env.JWT_SECRET = 'phase-two-test-secret';
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
    name: 'Phase Two User ' + suffix,
    student_id: 'D92345' + suffix,
    email: 'phase-two-' + suffix + '@example.com',
    password: 'abc123'
  });
  assert.equal(response.status, 201);
  return response.body;
}

async function createProject(app, token, overrides) {
  var body = Object.assign({
    title: 'Favorite Project',
    description: 'A project for phase two tests',
    required_skills: 'Vue, Node.js, SQLite',
    current_members: 1,
    max_members: 3,
    accepting_applications: true
  }, overrides || {});

  var response = await request(app, 'POST', '/api/projects', body, token);
  assert.equal(response.status, 201);
  return response.body.project;
}

test('users can favorite projects and filter the project list to favorites', async function() {
  var ctx = createContext();
  try {
    var owner = await register(ctx.app, '01');
    var viewer = await register(ctx.app, '02');
    var favoriteProject = await createProject(ctx.app, owner.token, { title: 'Saved Project' });
    await createProject(ctx.app, owner.token, { title: 'Other Project' });

    var saved = await request(ctx.app, 'POST', '/api/projects/' + favoriteProject.id + '/favorite', null, viewer.token);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.favorited, true);

    var listed = await request(ctx.app, 'GET', '/api/projects?filter=favorited', null, viewer.token);
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body.projects.map(function(project) {
      return project.title;
    }), ['Saved Project']);
    assert.equal(listed.body.projects[0].is_favorited, 1);

    var removed = await request(ctx.app, 'DELETE', '/api/projects/' + favoriteProject.id + '/favorite', null, viewer.token);
    assert.equal(removed.status, 200);
    assert.equal(removed.body.favorited, false);

    var afterRemoved = await request(ctx.app, 'GET', '/api/projects?filter=favorited', null, viewer.token);
    assert.equal(afterRemoved.status, 200);
    assert.equal(afterRemoved.body.projects.length, 0);
  } finally {
    await ctx.cleanup();
  }
});

test('full projects are returned as full and reject new applications', async function() {
  var ctx = createContext();
  try {
    var owner = await register(ctx.app, '03');
    var applicant = await register(ctx.app, '04');
    var project = await createProject(ctx.app, owner.token, {
      title: 'Full Project',
      current_members: 2,
      max_members: 2,
      status: 'open'
    });

    assert.equal(project.status, 'full');

    var listed = await request(ctx.app, 'GET', '/api/projects', null, applicant.token);
    assert.equal(listed.status, 200);
    assert.equal(listed.body.projects[0].status, 'full');
    assert.equal(listed.body.projects[0].current_members, 2);
    assert.equal(listed.body.projects[0].max_members, 2);

    var applied = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/apply', {
      message: 'I would like to join'
    }, applicant.token);
    assert.equal(applied.status, 400);
    assert.match(applied.body.message, /額滿|full|不開放/);
  } finally {
    await ctx.cleanup();
  }
});

test('project list exposes pending application status after the user applies', async function() {
  var ctx = createContext();
  try {
    var owner = await register(ctx.app, '05');
    var applicant = await register(ctx.app, '06');
    var project = await createProject(ctx.app, owner.token, {
      title: 'Pending Project'
    });

    var applied = await request(ctx.app, 'POST', '/api/projects/' + project.id + '/apply', {
      message: 'I would like to join'
    }, applicant.token);
    assert.equal(applied.status, 201);
    assert.equal(applied.body.application.status, 'pending');

    var listed = await request(ctx.app, 'GET', '/api/projects', null, applicant.token);
    assert.equal(listed.status, 200);
    assert.equal(listed.body.projects[0].id, project.id);
    assert.equal(listed.body.projects[0].application_status, 'pending');
  } finally {
    await ctx.cleanup();
  }
});

test('project github urls are optional, persisted, and must use github prefix', async function() {
  var ctx = createContext();
  try {
    var owner = await register(ctx.app, '07');
    var repoUrl = 'https://github.com/teamup-campus/final-project';

    var created = await createProject(ctx.app, owner.token, {
      title: 'GitHub Project',
      github_url: repoUrl
    });
    assert.equal(created.github_url, repoUrl);

    var listed = await request(ctx.app, 'GET', '/api/projects');
    assert.equal(listed.status, 200);
    assert.equal(listed.body.projects[0].github_url, repoUrl);

    var group = await request(ctx.app, 'GET', '/api/groups/' + created.id, null, owner.token);
    assert.equal(group.status, 200);
    assert.equal(group.body.group.github_url, repoUrl);

    var invalidCreate = await request(ctx.app, 'POST', '/api/projects', {
      title: 'Invalid GitHub Project',
      description: 'Invalid github url test',
      max_members: 3,
      github_url: 'https://gitlab.com/teamup-campus/final-project'
    }, owner.token);
    assert.equal(invalidCreate.status, 400);
    assert.match(invalidCreate.body.message, /GitHub|github/);

    var updated = await request(ctx.app, 'PATCH', '/api/groups/' + created.id, {
      title: 'GitHub Project',
      description: 'Project with updated GitHub repo',
      max_members: 3,
      accepting_applications: true,
      github_url: 'https://github.com/teamup-campus/updated-repo'
    }, owner.token);
    assert.equal(updated.status, 200);
    assert.equal(updated.body.project.github_url, 'https://github.com/teamup-campus/updated-repo');

    var cleared = await request(ctx.app, 'PATCH', '/api/groups/' + created.id, {
      title: 'GitHub Project',
      description: 'Project with optional GitHub repo cleared',
      max_members: 3,
      accepting_applications: true,
      github_url: ''
    }, owner.token);
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.project.github_url, '');
  } finally {
    await ctx.cleanup();
  }
});
