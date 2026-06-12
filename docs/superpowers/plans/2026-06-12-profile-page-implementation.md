# Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build authenticated self-editable and public read-only profile pages with avatar upload, private student ID visibility, and homepage profile links.

**Architecture:** Add a small profile API surface to the existing Express router, keep SQLite as the source of truth, and store avatar files under `public/uploads/avatars` while saving only `avatar_url` in `users`. Add a reusable `profile.html` + `profile.js` page that switches between self-edit and public-view mode based on the URL.

**Tech Stack:** Express 4, SQLite3, JWT auth middleware, Vue 3 global CDN, Node built-in `node:test` and `assert`, plain CSS in `public/stylesheets/style.css`.

---

## File Structure

- Modify `database/db.js`
  - Add `TEAMUP_DB_PATH` support so tests can use a temporary SQLite file.
  - Add `avatar_url` migration to `users`.
  - Export `close()` for tests.

- Modify `routes/api.js`
  - Expand self profile serialization.
  - Add public profile serialization.
  - Add `GET /api/users/:id`.
  - Update `PUT /api/users/me`.
  - Add `POST /api/users/me/avatar`.
  - Use `TEAMUP_AVATAR_DIR` during tests and `public/uploads/avatars` in normal app runs.
  - Include owner/applicant user IDs in responses needed for profile links.

- Modify `routes/pages.js`
  - Add `/profile`.
  - Add `/users/:id`.

- Create `public/profile.html`
  - Profile page shell with top banner layout.

- Create `public/javascripts/profile.js`
  - Vue app for self/public profile behavior.

- Modify `public/index.html`
  - Add a topbar profile link.
  - Add project owner link markup where the data already contains `owner_id`.

- Modify `public/javascripts/main.js`
  - Add helper methods for profile URLs.
  - Keep logout behavior unchanged.

- Modify `public/stylesheets/style.css`
  - Add profile page layout and avatar styles.
  - Keep existing design system colors and 6-8px radius conventions.

- Create `tests/profile-api.test.js`
  - API coverage for privacy, updates, and avatar upload.

- Create `tests/profile-static.test.js`
  - Static smoke checks for the new profile page shell and homepage entry point.

- Modify `package.json`
  - Add `"test": "node --test tests/*.test.js"`.

---

### Task 1: Add Isolated Test Harness And Database Migration

**Files:**
- Modify: `package.json`
- Modify: `database/db.js`
- Create: `tests/profile-api.test.js`

- [ ] **Step 1: Write the failing database isolation test**

Create `tests/profile-api.test.js` with this initial content:

```js
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var os = require('node:os');
var path = require('node:path');

test('database uses TEAMUP_DB_PATH and creates avatar_url column', async function() {
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamup-profile-'));
  var tempDbPath = path.join(tempDir, 'test.sqlite');
  process.env.TEAMUP_DB_PATH = tempDbPath;

  delete require.cache[require.resolve('../database/db')];
  var db = require('../database/db');

  var columns = await db.all('PRAGMA table_info(users)');
  var columnNames = columns.map(function(column) {
    return column.name;
  });

  assert.equal(fs.existsSync(tempDbPath), true);
  assert.equal(columnNames.indexOf('avatar_url') >= 0, true);

  await db.close();
});
```

- [ ] **Step 2: Add the test script**

Modify `package.json` so `scripts` is:

```json
"scripts": {
  "start": "node ./bin/www",
  "test": "node --test tests/*.test.js"
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```bash
npm test
```

Expected: FAIL because `database/db.js` ignores `TEAMUP_DB_PATH`, does not create `avatar_url`, and does not export `close()`.

- [ ] **Step 4: Implement the database changes**

In `database/db.js`, replace the current `dbPath` line:

```js
var dbPath = path.join(__dirname, 'teamup.sqlite');
```

with:

```js
var dbPath = process.env.TEAMUP_DB_PATH || path.join(__dirname, 'teamup.sqlite');
```

In the `CREATE TABLE IF NOT EXISTS users` SQL, add `avatar_url TEXT,` after `bio TEXT,`:

```js
'skills TEXT,' +
'bio TEXT,' +
'avatar_url TEXT,' +
'created_at TEXT DEFAULT CURRENT_TIMESTAMP' +
```

After the existing `ALTER TABLE users ADD COLUMN student_id TEXT` block, add:

```js
db.run('ALTER TABLE users ADD COLUMN avatar_url TEXT', function(err) {
  if (err && err.message.indexOf('duplicate column name') === -1) {
    console.error(err);
  }
});
```

Add this function near the other DB helpers:

```js
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
```

Export it:

```js
module.exports = {
  all: all,
  get: get,
  run: run,
  close: close
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
npm test
```

Expected: PASS for `database uses TEAMUP_DB_PATH and creates avatar_url column`.

- [ ] **Step 6: Commit**

Run:

```bash
git add package.json database/db.js tests/profile-api.test.js
git commit -m "test: add isolated profile database harness"
```

---

### Task 2: Add Profile API Privacy And Update Behavior

**Files:**
- Modify: `tests/profile-api.test.js`
- Modify: `routes/api.js`

- [ ] **Step 1: Add HTTP test helpers and failing profile API test**

Append this helper code to `tests/profile-api.test.js`:

```js
function freshAppWithTempDb() {
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamup-profile-'));
  process.env.TEAMUP_DB_PATH = path.join(tempDir, 'test.sqlite');
  process.env.TEAMUP_AVATAR_DIR = path.join(tempDir, 'avatars');
  process.env.JWT_SECRET = 'profile-test-secret';

  ['../database/db', '../middleware/auth', '../routes/api', '../app'].forEach(function(modulePath) {
    delete require.cache[require.resolve(modulePath)];
  });

  var app = require('../app');
  var db = require('../database/db');
  return { app: app, db: db, tempDir: tempDir };
}

function request(app, method, url, body, token) {
  return new Promise(function(resolve, reject) {
    var server = app.listen(0, function() {
      var address = server.address();
      var payload = body ? JSON.stringify(body) : '';
      var options = {
        hostname: '127.0.0.1',
        port: address.port,
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

      var req = require('node:http').request(options, function(res) {
        var chunks = '';
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
          chunks += chunk;
        });
        res.on('end', function() {
          server.close(function() {
            resolve({
              status: res.statusCode,
              body: chunks ? JSON.parse(chunks) : {}
            });
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
  var res = await request(app, 'POST', '/api/register', {
    name: '測試使用者' + suffix,
    student_id: 'D12345' + suffix,
    email: 'user' + suffix + '@example.com',
    password: 'abc123'
  });
  assert.equal(res.status, 201);
  return res.body;
}
```

Append this failing test:

```js
test('profile APIs keep student ID private and update owner fields', async function() {
  var ctx = freshAppWithTempDb();
  var first = await register(ctx.app, '01');
  var second = await register(ctx.app, '02');

  var selfBefore = await request(ctx.app, 'GET', '/api/users/me', null, first.token);
  assert.equal(selfBefore.status, 200);
  assert.equal(selfBefore.body.user.student_id, 'D1234501');
  assert.equal(selfBefore.body.user.class_name, '');
  assert.equal(selfBefore.body.user.bio, '');
  assert.equal(selfBefore.body.user.avatar_url, '');

  var update = await request(ctx.app, 'PUT', '/api/users/me', {
    name: '新的名字',
    class_name: '資工三甲',
    bio: '喜歡做網頁和找隊友',
    student_id: 'D9999999'
  }, first.token);
  assert.equal(update.status, 200);
  assert.equal(update.body.user.name, '新的名字');
  assert.equal(update.body.user.class_name, '資工三甲');
  assert.equal(update.body.user.bio, '喜歡做網頁和找隊友');
  assert.equal(update.body.user.student_id, 'D1234501');

  var publicProfile = await request(ctx.app, 'GET', '/api/users/' + first.user.id, null, second.token);
  assert.equal(publicProfile.status, 200);
  assert.equal(publicProfile.body.user.name, '新的名字');
  assert.equal(publicProfile.body.user.class_name, '資工三甲');
  assert.equal(publicProfile.body.user.bio, '喜歡做網頁和找隊友');
  assert.equal(Object.prototype.hasOwnProperty.call(publicProfile.body.user, 'student_id'), false);

  var loggedOut = await request(ctx.app, 'GET', '/api/users/' + first.user.id);
  assert.equal(loggedOut.status, 401);

  await ctx.db.close();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test
```

Expected: FAIL because `/api/users/:id` does not exist and `publicUser()` omits `class_name`, `bio`, and `avatar_url`.

- [ ] **Step 3: Implement serializers in `routes/api.js`**

Replace `publicUser(row)` with these two functions:

```js
function selfUser(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    student_id: row.student_id,
    class_name: row.class_name || '',
    email: row.email,
    bio: row.bio || '',
    avatar_url: row.avatar_url || '',
    created_at: row.created_at
  };
}

function publicUser(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    class_name: row.class_name || '',
    bio: row.bio || '',
    avatar_url: row.avatar_url || '',
    created_at: row.created_at
  };
}
```

Update register and login responses to use `selfUser(user)`:

```js
res.status(201).json({ token: auth.signToken(user), user: selfUser(user) });
```

```js
res.json({ token: auth.signToken(user), user: selfUser(user) });
```

Update `GET /users/me`:

```js
router.get('/users/me', auth.authRequired, asyncHandler(async function(req, res) {
  var user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: selfUser(user) });
}));
```

Replace `PUT /users/me`:

```js
router.put('/users/me', auth.authRequired, asyncHandler(async function(req, res) {
  var body = req.body;
  if (!required(body.name)) {
    res.status(400).json({ message: '姓名為必填' });
    return;
  }

  await db.run(
    'UPDATE users SET name = ?, class_name = ?, bio = ? WHERE id = ?',
    [String(body.name).trim(), body.class_name || '', body.bio || '', req.user.id]
  );
  var user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: selfUser(user) });
}));
```

Add this route after `PUT /users/me` and before `/projects` routes so `/users/me` remains the specific match:

```js
router.get('/users/:id', auth.authRequired, asyncHandler(async function(req, res) {
  var user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) {
    res.status(404).json({ message: '找不到使用者' });
    return;
  }
  res.json({ user: publicUser(user) });
}));
```

- [ ] **Step 4: Run the tests**

Run:

```bash
npm test
```

Expected: PASS for database isolation and profile privacy/update tests.

- [ ] **Step 5: Commit**

Run:

```bash
git add routes/api.js tests/profile-api.test.js
git commit -m "feat: add profile API privacy and updates"
```

---

### Task 3: Add Avatar Upload API

**Files:**
- Modify: `tests/profile-api.test.js`
- Modify: `routes/api.js`

- [ ] **Step 1: Write failing avatar upload tests**

Append to `tests/profile-api.test.js`:

```js
test('avatar upload stores allowed image and rejects invalid payloads', async function() {
  var ctx = freshAppWithTempDb();
  var created = await register(ctx.app, '03');
  var tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

  var upload = await request(ctx.app, 'POST', '/api/users/me/avatar', {
    file_name: 'avatar.png',
    mime_type: 'image/png',
    data: tinyPngBase64
  }, created.token);

  assert.equal(upload.status, 200);
  assert.match(upload.body.user.avatar_url, /^\/uploads\/avatars\/user-/);
  assert.match(upload.body.user.avatar_url, /\.png$/);

  var savedFile = path.join(ctx.tempDir, 'avatars', path.basename(upload.body.user.avatar_url));
  assert.equal(fs.existsSync(savedFile), true);

  var invalidType = await request(ctx.app, 'POST', '/api/users/me/avatar', {
    file_name: 'avatar.gif',
    mime_type: 'image/gif',
    data: tinyPngBase64
  }, created.token);
  assert.equal(invalidType.status, 400);

  var tooLarge = await request(ctx.app, 'POST', '/api/users/me/avatar', {
    file_name: 'avatar.png',
    mime_type: 'image/png',
    data: Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64')
  }, created.token);
  assert.equal(tooLarge.status, 400);

  await ctx.db.close();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test
```

Expected: FAIL because `POST /api/users/me/avatar` does not exist.

- [ ] **Step 3: Implement avatar upload helpers**

At the top of `routes/api.js`, add:

```js
var fs = require('fs');
var path = require('path');
```

After `boolToInt`, add:

```js
var AVATAR_MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};
var MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function avatarUploadDir() {
  if (process.env.TEAMUP_AVATAR_DIR) {
    return process.env.TEAMUP_AVATAR_DIR;
  }
  return path.join(__dirname, '..', 'public', 'uploads', 'avatars');
}

function decodeAvatar(body) {
  if (!body || !body.data || !body.mime_type) {
    return { error: '請選擇頭像圖片' };
  }

  var extension = AVATAR_MIME_EXTENSIONS[body.mime_type];
  if (!extension) {
    return { error: '頭像只支援 JPG、PNG 或 WebP' };
  }

  var buffer;
  try {
    buffer = Buffer.from(String(body.data), 'base64');
  } catch (err) {
    return { error: '頭像資料格式錯誤' };
  }

  if (!buffer.length) {
    return { error: '請選擇頭像圖片' };
  }
  if (buffer.length > MAX_AVATAR_BYTES) {
    return { error: '頭像大小不可超過 2MB' };
  }

  return { buffer: buffer, extension: extension };
}
```

- [ ] **Step 4: Implement avatar route**

Add after `PUT /users/me`:

```js
router.post('/users/me/avatar', auth.authRequired, asyncHandler(async function(req, res) {
  var decoded = decodeAvatar(req.body);
  if (decoded.error) {
    res.status(400).json({ message: decoded.error });
    return;
  }

  var dir = avatarUploadDir();
  await fs.promises.mkdir(dir, { recursive: true });

  var filename = 'user-' + req.user.id + '-' + Date.now() + '.' + decoded.extension;
  var diskPath = path.join(dir, filename);
  var publicPath = '/uploads/avatars/' + filename;

  await fs.promises.writeFile(diskPath, decoded.buffer);
  await db.run('UPDATE users SET avatar_url = ? WHERE id = ?', [publicPath, req.user.id]);

  var user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: selfUser(user), avatar_url: publicPath });
}));
```

- [ ] **Step 5: Run the tests**

Run:

```bash
npm test
```

Expected: PASS for all profile API tests.

- [ ] **Step 6: Commit**

Run:

```bash
git add routes/api.js tests/profile-api.test.js
git commit -m "feat: add profile avatar upload API"
```

---

### Task 4: Add Profile Page Routes, HTML, And Frontend Logic

**Files:**
- Create: `tests/profile-static.test.js`
- Modify: `routes/pages.js`
- Create: `public/profile.html`
- Create: `public/javascripts/profile.js`
- Modify: `public/stylesheets/style.css`

- [ ] **Step 1: Write failing static page test**

Create `tests/profile-static.test.js`:

```js
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

function read(filePath) {
  return fs.readFileSync(path.join(__dirname, '..', filePath), 'utf8');
}

test('profile page shell and script exist', function() {
  var html = read('public/profile.html');
  var script = read('public/javascripts/profile.js');
  var css = read('public/stylesheets/style.css');

  assert.match(html, /id="profile-app"/);
  assert.match(html, /\/javascripts\/profile\.js/);
  assert.match(script, /isOwnProfile/);
  assert.match(script, /\/users\/me\/avatar/);
  assert.match(css, /\.profile-hero/);
  assert.match(css, /\.avatar-preview/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test
```

Expected: FAIL because `public/profile.html` and `public/javascripts/profile.js` do not exist.

- [ ] **Step 3: Add page routes**

In `routes/pages.js`, add before `module.exports`:

```js
router.get('/profile', function(req, res) {
  res.sendFile(path.join(publicDir, 'profile.html'));
});

router.get('/users/:id', function(req, res) {
  res.sendFile(path.join(publicDir, 'profile.html'));
});
```

- [ ] **Step 4: Create `public/profile.html`**

Create `public/profile.html`:

```html
<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>個人檔案 | TeamUp Campus</title>
  <link rel="stylesheet" href="/stylesheets/style.css">
  <script>
    if (!localStorage.getItem('teamup_token')) {
      window.location.replace('/login');
    }
  </script>
</head>
<body>
  <div id="profile-app" v-cloak>
    <header class="topbar compact-topbar">
      <div>
        <p class="eyebrow">TeamUp</p>
        <h1>{{ isOwnProfile ? '我的個人檔案' : '個人檔案' }}</h1>
      </div>
      <div class="user-panel">
        <a class="button ghost" href="/">回首頁</a>
        <button class="ghost" type="button" @click="logout">登出</button>
      </div>
    </header>

    <main class="profile-page">
      <section v-if="loading" class="panel">載入中...</section>

      <section v-else-if="notFound" class="panel">
        <h2>找不到使用者</h2>
        <p class="description">這個個人檔案不存在，或你沒有查看權限。</p>
      </section>

      <template v-else>
        <section class="profile-hero">
          <div class="avatar-preview">
            <img v-if="profile.avatar_url" :src="profile.avatar_url" alt="使用者頭像">
            <span v-else>{{ avatarInitial }}</span>
          </div>
          <div class="profile-heading">
            <p class="eyebrow">{{ isOwnProfile ? 'Private Profile' : 'Public Profile' }}</p>
            <h2>{{ profile.name || '未命名使用者' }}</h2>
            <p>{{ profile.class_name || '尚未填寫班級' }}</p>
            <p v-if="isOwnProfile" class="private-field">學號：{{ profile.student_id }}</p>
          </div>
        </section>

        <section class="profile-content">
          <article class="panel profile-bio">
            <div class="section-title">
              <h2>個人簡介</h2>
              <p>{{ profile.bio || '這位使用者尚未填寫個人簡介。' }}</p>
            </div>
          </article>

          <form v-if="isOwnProfile" class="panel grid-form profile-edit-form" @submit.prevent="saveProfile">
            <div class="section-title full">
              <h2>編輯資料</h2>
              <p>學號只供本人查看，不能在這裡修改。</p>
            </div>

            <label>頭像
              <input type="file" accept="image/jpeg,image/png,image/webp" @change="uploadAvatar">
            </label>
            <label>學號
              <input :value="profile.student_id" disabled>
            </label>
            <label>姓名
              <input v-model.trim="form.name" required>
            </label>
            <label>班級
              <input v-model.trim="form.class_name" placeholder="例如：資工三甲">
            </label>
            <label class="full">個人簡介
              <textarea v-model.trim="form.bio" rows="5" placeholder="簡單介紹你的專長、興趣或想找的隊友類型"></textarea>
            </label>
            <div class="form-actions full">
              <button type="submit">儲存變更</button>
            </div>
          </form>
        </section>
      </template>

      <div class="toast" :class="{ show: toast }" role="status" aria-live="polite">{{ toast }}</div>
    </main>
  </div>

  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
  <script src="/javascripts/profile.js"></script>
</body>
</html>
```

- [ ] **Step 5: Create `public/javascripts/profile.js`**

Create `public/javascripts/profile.js`:

```js
var createApp = Vue.createApp;

createApp({
  data: function() {
    return {
      token: localStorage.getItem('teamup_token') || '',
      currentUser: JSON.parse(localStorage.getItem('teamup_user') || 'null'),
      profile: null,
      form: {
        name: '',
        class_name: '',
        bio: ''
      },
      loading: true,
      notFound: false,
      toast: ''
    };
  },
  computed: {
    isOwnProfile: function() {
      return window.location.pathname === '/profile';
    },
    avatarInitial: function() {
      return this.profile && this.profile.name ? this.profile.name.charAt(0) : '?';
    }
  },
  mounted: function() {
    if (!this.token) {
      window.location.href = '/login';
      return;
    }
    this.loadProfile();
  },
  methods: {
    api: function(path, options) {
      options = options || {};
      options.headers = options.headers || {};
      options.headers.Authorization = 'Bearer ' + this.token;
      if (options.body && !options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json';
      }
      return fetch('/api' + path, options).then(function(res) {
        return res.json().then(function(data) {
          if (!res.ok) {
            throw new Error(data.message || '操作失敗');
          }
          return data;
        });
      });
    },
    showToast: function(message) {
      var vm = this;
      this.toast = message;
      window.clearTimeout(this.toastTimer);
      this.toastTimer = window.setTimeout(function() {
        vm.toast = '';
      }, 2400);
    },
    loadProfile: function() {
      var vm = this;
      var path = this.isOwnProfile ? '/users/me' : '/users/' + window.location.pathname.split('/').pop();
      this.loading = true;
      this.notFound = false;
      return this.api(path).then(function(data) {
        vm.profile = data.user;
        vm.form.name = data.user.name || '';
        vm.form.class_name = data.user.class_name || '';
        vm.form.bio = data.user.bio || '';
      }).catch(function(err) {
        vm.notFound = true;
        vm.showToast(err.message);
      }).finally(function() {
        vm.loading = false;
      });
    },
    saveProfile: function() {
      var vm = this;
      return this.api('/users/me', {
        method: 'PUT',
        body: JSON.stringify(this.form)
      }).then(function(data) {
        vm.profile = data.user;
        localStorage.setItem('teamup_user', JSON.stringify(data.user));
        vm.showToast('個人檔案已更新');
      }).catch(function(err) {
        vm.showToast(err.message);
      });
    },
    uploadAvatar: function(event) {
      var vm = this;
      var file = event.target.files[0];
      if (!file) {
        return;
      }
      if (['image/jpeg', 'image/png', 'image/webp'].indexOf(file.type) < 0) {
        this.showToast('頭像只支援 JPG、PNG 或 WebP');
        event.target.value = '';
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        this.showToast('頭像大小不可超過 2MB');
        event.target.value = '';
        return;
      }

      var reader = new FileReader();
      reader.onload = function() {
        var dataUrl = String(reader.result);
        var base64 = dataUrl.split(',')[1] || '';
        vm.api('/users/me/avatar', {
          method: 'POST',
          body: JSON.stringify({
            file_name: file.name,
            mime_type: file.type,
            data: base64
          })
        }).then(function(data) {
          vm.profile = data.user;
          localStorage.setItem('teamup_user', JSON.stringify(data.user));
          vm.showToast('頭像已更新');
        }).catch(function(err) {
          vm.showToast(err.message);
        }).finally(function() {
          event.target.value = '';
        });
      };
      reader.readAsDataURL(file);
    },
    logout: function() {
      localStorage.removeItem('teamup_token');
      localStorage.removeItem('teamup_user');
      window.location.href = '/login';
    }
  }
}).mount('#profile-app');
```

- [ ] **Step 6: Add profile CSS**

Append to `public/stylesheets/style.css` before the `@media` block:

```css
.profile-page {
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px clamp(14px, 3vw, 32px) 48px;
}

.profile-hero {
  align-items: center;
  background: linear-gradient(135deg, #10201d, #256f63);
  border-radius: 8px;
  color: white;
  display: flex;
  gap: 24px;
  margin-bottom: 18px;
  min-height: 220px;
  padding: clamp(20px, 4vw, 38px);
}

.avatar-preview {
  align-items: center;
  background: rgba(255, 255, 255, 0.16);
  border: 3px solid rgba(255, 255, 255, 0.72);
  border-radius: 50%;
  display: flex;
  flex: 0 0 auto;
  height: 132px;
  justify-content: center;
  overflow: hidden;
  width: 132px;
}

.avatar-preview img {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.avatar-preview span {
  color: white;
  font-size: 52px;
  font-weight: 800;
}

.profile-heading h2 {
  font-size: clamp(32px, 5vw, 54px);
  line-height: 1.05;
  margin: 0 0 8px;
}

.profile-heading p {
  margin: 0;
}

.private-field {
  color: rgba(255, 255, 255, 0.78);
  margin-top: 10px !important;
}

.profile-content {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr);
}

.profile-bio .section-title {
  margin-bottom: 0;
}

.profile-edit-form textarea {
  resize: none;
}
```

Inside the existing `@media (max-width: 860px)` block, add:

```css
  .profile-hero {
    align-items: flex-start;
    flex-direction: column;
  }
```

- [ ] **Step 7: Run tests**

Run:

```bash
npm test
```

Expected: PASS for API and static profile page tests.

- [ ] **Step 8: Commit**

Run:

```bash
git add routes/pages.js public/profile.html public/javascripts/profile.js public/stylesheets/style.css tests/profile-static.test.js
git commit -m "feat: add profile page UI"
```

---

### Task 5: Add Homepage Profile Entry And User Profile Links

**Files:**
- Modify: `tests/profile-static.test.js`
- Modify: `public/index.html`
- Modify: `public/javascripts/main.js`
- Modify: `routes/api.js`

- [ ] **Step 1: Add failing static homepage checks**

Append to `tests/profile-static.test.js`:

```js
test('homepage exposes profile entry and owner profile links', function() {
  var html = read('public/index.html');
  var main = read('public/javascripts/main.js');

  assert.match(html, /href="\/profile"/);
  assert.match(html, /profileUrl\(project\.owner_id\)/);
  assert.match(main, /profileUrl: function/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test
```

Expected: FAIL because homepage has no `/profile` entry and no `profileUrl` helper.

- [ ] **Step 3: Update homepage topbar**

In `public/index.html`, inside `.user-panel`, place the profile link before the logout button:

```html
<a v-if="user" class="button ghost" href="/profile">個人檔案</a>
<button v-if="user" class="ghost" type="button" @click="logout">登出</button>
```

Keep the existing logged-in user display span.

- [ ] **Step 4: Link project owners**

In `public/index.html`, replace the owner name portion in the project meta block:

```html
撱箇???{{ project.owner_name }}
```

with valid Traditional Chinese text and link markup:

```html
發起人：
<a :href="profileUrl(project.owner_id)">{{ project.owner_name }}</a>
```

If the surrounding mojibake makes the exact line hard to patch, replace the full `.meta` block under each project title with:

```html
<div class="meta">
  {{ project.course_name || '未填課程' }} ·
  {{ project.teacher_name || '未填老師' }} ·
  發起人：
  <a :href="profileUrl(project.owner_id)">{{ project.owner_name }}</a>
</div>
```

- [ ] **Step 5: Add helper in `main.js`**

Inside the `methods` object in `public/javascripts/main.js`, add:

```js
profileUrl: function(userId) {
  return '/users/' + userId;
},
```

Place it near `logout` or other navigation-related helpers.

- [ ] **Step 6: Include applicant user IDs for future links**

In `routes/api.js`, update `applicationById(id)` query to include:

```sql
users.id AS applicant_id
```

The resulting string should start like:

```js
'SELECT applications.*, users.id AS applicant_id, users.name AS applicant_name, projects.title AS project_title FROM applications ' +
```

In `GET /projects/:id/applications`, update the select list to include:

```sql
users.id AS applicant_id
```

The string should start like:

```js
'SELECT applications.*, users.id AS applicant_id, users.name AS applicant_name, users.email AS applicant_email, users.skills AS applicant_skills ' +
```

- [ ] **Step 7: Link applicant names when ID is present**

In `public/index.html`, in the application row, replace:

```html
<span>{{ item.applicant_name }} 繚 {{ item.applicant_skills || '?芸‵??? }} 繚 {{ item.message || '?芸‵?唾?閮' }}</span>
```

with:

```html
<span>
  <a v-if="item.applicant_id" :href="profileUrl(item.applicant_id)">{{ item.applicant_name }}</a>
  <template v-else>{{ item.applicant_name }}</template>
  · {{ item.applicant_skills || '未填技能' }}
  · {{ item.message || '未填申請訊息' }}
</span>
```

- [ ] **Step 8: Run tests**

Run:

```bash
npm test
```

Expected: PASS for API and static tests.

- [ ] **Step 9: Commit**

Run:

```bash
git add public/index.html public/javascripts/main.js routes/api.js tests/profile-static.test.js
git commit -m "feat: link profiles from homepage"
```

---

### Task 6: Manual Verification And Final Fixes

**Files:**
- Modify only files needed to fix issues found during verification.

- [ ] **Step 1: Start the app**

Run:

```bash
npm start
```

Expected: Express starts using `node ./bin/www`. Note the port printed or configured by `bin/www`; typical Express generator apps use `http://localhost:3000`.

- [ ] **Step 2: Verify automated tests**

In a second terminal, run:

```bash
npm test
```

Expected: PASS for all tests.

- [ ] **Step 3: Verify logged-out redirects**

Open:

```text
http://localhost:3000/profile
```

Expected: browser redirects to `/login`.

Open:

```text
http://localhost:3000/users/1
```

Expected: page shell redirects to `/login` because no token exists.

- [ ] **Step 4: Verify self profile flow**

Use the app UI to register or log in, then open:

```text
http://localhost:3000/profile
```

Expected:

- Top banner appears.
- Avatar placeholder appears if no avatar exists.
- Name and class display in the banner.
- Student ID appears and its input is disabled.
- Editing name, class, and bio then clicking `儲存變更` shows `個人檔案已更新`.
- Refreshing the page keeps the saved values.

- [ ] **Step 5: Verify avatar upload**

On `/profile`, select a small `.png`, `.jpg`, or `.webp` under 2 MB.

Expected:

- Toast says `頭像已更新`.
- Banner avatar changes to the uploaded image.
- A file appears under `public/uploads/avatars`.

Try a `.gif` or a file larger than 2 MB.

Expected:

- Toast shows the validation error.
- Existing avatar remains visible.

- [ ] **Step 6: Verify public profile privacy**

Create or log in as a second user, then open the first user's profile URL:

```text
http://localhost:3000/users/<first-user-id>
```

Expected:

- Public page shows avatar, name, class, and bio.
- Student ID is not visible.
- No edit form or upload input appears.

- [ ] **Step 7: Verify homepage links**

Open:

```text
http://localhost:3000/
```

Expected:

- Topbar has `個人檔案` link that opens `/profile`.
- Project owner names open `/users/:id`.
- Applicant names open `/users/:id` when visible to a project owner.

- [ ] **Step 8: Commit verification fixes**

If verification required fixes, run:

```bash
git add <changed-files>
git commit -m "fix: polish profile verification issues"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review Notes

- Spec coverage: The plan covers `/profile`, `/users/:id`, editable self fields, student ID privacy, avatar path storage, authenticated public viewing, homepage entry, profile links, validation, and manual verification.
- Test coverage: Tasks add Node built-in API tests and static frontend smoke tests, plus manual browser verification for UI and upload behavior.
- Dependency check: No new npm package is required. Avatar upload uses JSON/base64 and Node `fs.promises`.
- Data safety: Test database isolation is the first task so automated tests do not write to `database/teamup.sqlite`.
