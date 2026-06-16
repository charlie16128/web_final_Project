# admin 功能 SDD 規劃

> 專案：TeamUp Campus  
> 目標：新增管理員後台、檢舉處理、成員管理、警告/封禁、admin 查看與管理任一群組功能。  
> 目前專案技術基礎：Vue 3 + Vite、Express API、JWT auth、SQLite。

---

## 1. 目前專案狀態判斷

根據目前專案結構，前端在 `client/`，後端在 `server/`，README 顯示專案使用 Vue 3 + Vite + Vue Router + Axios，後端為 Express API + JWT auth + SQLite database。

目前資料庫已經有：

- `users`
- `projects`
- `applications`
- `comments`
- `favorites`
- `project_favorites`
- `project_announcements`
- `project_deadlines`
- `project_invitations`
- `notifications`

目前也已經有固定的 superadmin 帳號：

- username：`admin2006`
- email：`admin@gmail.com`
- password：`admin2006`
- role：`super_admin`

目前後端 `api.js` 已經有 `isAdminRole(user)` 的概念，判斷 `admin` 和 `super_admin` 都是管理員角色，因此這次 admin 功能可以延續這個權限設計。

---

## 2. 功能總目標

這次要新增一套完整 admin 管理系統，包含：

1. 主畫面「我的申請」下方新增紅色「管理員專用介面」按鈕。
2. admin 頁面上方有兩個可切換介面：
   - 處理檢舉
   - 成員管理
3. 檢舉發送後會出現在 admin 頁面。
4. admin 可以選擇不處理、警告、封禁。
5. 警告訊息要在任意畫面顯示一次，顯示後從資料庫刪除。
6. 封禁可指定天數，成員管理也可解除封禁。
7. 成員管理可列出所有成員，並修改身分為 `user` 或 `admin`。
8. `admin` 權限與 `super_admin` 幾乎相同。
9. admin 可以直接點主畫面 project card 標題進入任一 group。
10. 一般使用者點進非自己群組時，只能看右側詳細資訊，看不到公告、倒數、留言。
11. admin 進入任一 group 時，要和群組擁有者一樣能做所有修改。

---

## 3. 角色與權限設計

### 3.1 角色定義

| role | 說明 |
|---|---|
| `user` | 一般使用者 |
| `admin` | 管理員，可管理檢舉、成員、封禁、查看所有群組 |
| `super_admin` | 系統最高管理員，固定帳號 `admin2006`，不可被降權或封禁 |

### 3.2 權限規則

| 功能 | user | admin | super_admin |
|---|---:|---:|---:|
| 查看公開專題列表 | ✅ | ✅ | ✅ |
| 點 project card 標題進入 group | ✅ 但只能看右側詳細資訊 | ✅ | ✅ |
| 查看非成員群組公告 | ❌ | ✅ | ✅ |
| 查看非成員群組倒數 | ❌ | ✅ | ✅ |
| 查看非成員群組留言 | ❌ | ✅ | ✅ |
| 修改任一群組 | ❌ | ✅ | ✅ |
| 處理檢舉 | ❌ | ✅ | ✅ |
| 修改使用者 role | ❌ | ✅ | ✅ |
| 封禁/警告使用者 | ❌ | ✅ | ✅ |
| 封禁 super_admin | ❌ | ❌ | ❌ |
| 將 super_admin 降成 user/admin | ❌ | ❌ | ❌ |

---

## 4. 資料庫設計

### 4.1 修改 users 表

目前 `users` 已有 `role` 與 `is_suspended`，但封禁需要記錄到期時間，所以要新增欄位。

```sql
ALTER TABLE users ADD COLUMN suspended_until TEXT;
ALTER TABLE users ADD COLUMN suspended_reason TEXT;
```

欄位說明：

| 欄位 | 型態 | 說明 |
|---|---|---|
| `is_suspended` | INTEGER | 0 = 未封禁，1 = 封禁中 |
| `suspended_until` | TEXT | 封禁到期時間，NULL 代表永久封禁或未封禁 |
| `suspended_reason` | TEXT | 封禁原因 |

判斷封禁狀態時：

- `is_suspended = 0`：可登入、可操作。
- `is_suspended = 1` 且 `suspended_until IS NULL`：永久封禁。
- `is_suspended = 1` 且 `suspended_until > now`：指定天數封禁中。
- `is_suspended = 1` 且 `suspended_until <= now`：後端自動解除封禁。

---

### 4.2 新增 reports 表

用來儲存檢舉資料。

```sql
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id TEXT NOT NULL,
    target_user_id TEXT,
    target_project_id INTEGER,
    target_comment_id INTEGER,
    reason TEXT NOT NULL,
    detail TEXT,
    status TEXT DEFAULT 'pending',
    handled_by TEXT,
    handled_action TEXT,
    handled_note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    handled_at TEXT,
    FOREIGN KEY(reporter_id) REFERENCES users(student_id) ON DELETE CASCADE,
    FOREIGN KEY(target_user_id) REFERENCES users(student_id) ON DELETE SET NULL,
    FOREIGN KEY(target_project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(target_comment_id) REFERENCES comments(id) ON DELETE SET NULL,
    FOREIGN KEY(handled_by) REFERENCES users(student_id) ON DELETE SET NULL
);
```

欄位說明：

| 欄位 | 說明 |
|---|---|
| `reporter_id` | 檢舉者學號 |
| `target_user_id` | 被檢舉使用者 |
| `target_project_id` | 被檢舉的群組/專題 |
| `target_comment_id` | 被檢舉留言，可為 NULL |
| `reason` | 檢舉原因 |
| `detail` | 詳細說明 |
| `status` | `pending` / `ignored` / `handled` |
| `handled_by` | 處理的 admin |
| `handled_action` | `ignore` / `warning` / `ban` |
| `handled_note` | 處理備註 |

---

### 4.3 新增 user_warnings 表

警告訊息要在任意畫面顯示一次，顯示完刪除，因此獨立成一張表。

```sql
CREATE TABLE IF NOT EXISTS user_warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(student_id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(student_id) ON DELETE CASCADE
);
```

顯示流程：

1. 使用者登入後，前端呼叫 `GET /api/me/warnings`。
2. 如果有警告，前端用彈窗或紅色 toast 顯示。
3. 前端顯示成功後呼叫 `DELETE /api/me/warnings/:id`。
4. 後端刪除該警告。

---

### 4.4 新增 punishments 表

用來留下處罰紀錄，避免只有 users 狀態但沒有歷史資料。

```sql
CREATE TABLE IF NOT EXISTS punishments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    admin_id TEXT NOT NULL,
    type TEXT NOT NULL,
    message TEXT,
    ban_days INTEGER,
    banned_until TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(student_id) ON DELETE CASCADE,
    FOREIGN KEY(admin_id) REFERENCES users(student_id) ON DELETE CASCADE
);
```

`type` 可用：

- `warning`
- `temporary_ban`
- `permanent_ban`
- `unban`

---

## 5. 後端 API 設計

### 5.1 admin 權限 middleware

新增或整理在 `server/middleware/auth.js` 或 `server/routes/api.js`。

```js
function requireAdmin(req, res, next) {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
        res.status(403).json({ message: '需要管理員權限' });
        return;
    }
    next();
}
```

建議所有 `/admin/*` API 都要套：

```js
router.use('/admin', auth.required, requireAdmin);
```

---

### 5.2 檢舉 API

#### 使用者送出檢舉

```http
POST /api/reports
```

body：

```json
{
    "target_user_id": "D1234567",
    "target_project_id": 1,
    "target_comment_id": 5,
    "reason": "不當言論",
    "detail": "留言內容包含攻擊字眼"
}
```

後端行為：

1. 檢查使用者是否登入。
2. 檢查至少有一個被檢舉目標。
3. 新增到 `reports`，狀態為 `pending`。
4. 回傳成功訊息。

---

#### admin 取得待處理檢舉

```http
GET /api/admin/reports?status=pending
```

回傳資料應包含：

```json
[
    {
        "id": 1,
        "reporter_name": "王小明",
        "target_user_name": "陳大文",
        "project_title": "資料庫期末專題",
        "comment_content": "...",
        "reason": "不當言論",
        "detail": "...",
        "created_at": "2026-06-16 12:00:00"
    }
]
```

---

#### admin 不處理檢舉

```http
PATCH /api/admin/reports/:id/ignore
```

body：

```json
{
    "note": "證據不足"
}
```

後端行為：

- `status = 'ignored'`
- `handled_action = 'ignore'`
- `handled_by = req.user.student_id`
- `handled_at = CURRENT_TIMESTAMP`

---

#### admin 處理檢舉：警告

```http
PATCH /api/admin/reports/:id/warn
```

body：

```json
{
    "target_user_id": "D1234567",
    "message": "你因為不當言論被管理員警告，請注意發言。"
}
```

後端行為：

1. 新增 `user_warnings`。
2. 新增 `punishments`，type = `warning`。
3. 更新 `reports` 狀態為 `handled`。

---

#### admin 處理檢舉：封禁

```http
PATCH /api/admin/reports/:id/ban
```

body：

```json
{
    "target_user_id": "D1234567",
    "ban_days": 7,
    "reason": "多次違規發言"
}
```

如果永久封禁：

```json
{
    "target_user_id": "D1234567",
    "ban_days": null,
    "reason": "嚴重違規"
}
```

後端行為：

1. 檢查不能封禁 `super_admin`。
2. 更新 users：
   - `is_suspended = 1`
   - `suspended_until = now + ban_days` 或 NULL
   - `suspended_reason = reason`
3. 新增 `punishments`。
4. 更新 `reports` 狀態為 `handled`。

---

### 5.3 成員管理 API

#### admin 取得所有成員

```http
GET /api/admin/users
```

回傳：

```json
[
    {
        "student_id": "D1234567",
        "name": "王小明",
        "email": "test@example.com",
        "role": "user",
        "is_suspended": 0,
        "suspended_until": null
    }
]
```

---

#### admin 修改身分

```http
PATCH /api/admin/users/:student_id/role
```

body：

```json
{
    "role": "admin"
}
```

限制：

- 只能改成 `user` 或 `admin`。
- 不能修改 `super_admin` 的 role。
- `admin` 和 `super_admin` 都可以改一般使用者 role。

---

#### admin 對成員警告

```http
POST /api/admin/users/:student_id/warn
```

body：

```json
{
    "message": "請遵守平台規範。"
}
```

---

#### admin 封禁成員

```http
POST /api/admin/users/:student_id/ban
```

body：

```json
{
    "ban_days": 3,
    "reason": "惡意洗版"
}
```

永久封禁：

```json
{
    "ban_days": null,
    "reason": "嚴重違規"
}
```

---

#### admin 解除封禁

```http
POST /api/admin/users/:student_id/unban
```

後端行為：

```sql
UPDATE users
SET is_suspended = 0,
    suspended_until = NULL,
    suspended_reason = NULL
WHERE student_id = ?;
```

同時新增 `punishments`，type = `unban`。

---

### 5.4 使用者警告 API

#### 取得自己的警告

```http
GET /api/me/warnings
```

回傳：

```json
[
    {
        "id": 1,
        "message": "你因為不當言論被警告。"
    }
]
```

---

#### 顯示後刪除警告

```http
DELETE /api/me/warnings/:id
```

限制：

- 只能刪除自己的警告。
- 前端要在警告顯示後呼叫。

---

### 5.5 登入時封禁檢查

在 `/login` 成功比對密碼後，回傳 token 前要檢查：

1. 如果 `is_suspended = 1` 且 `suspended_until IS NULL`：拒絕登入，顯示「帳號已被永久封禁」。
2. 如果 `is_suspended = 1` 且 `suspended_until > now`：拒絕登入，顯示「帳號封禁至 xxxx」。
3. 如果 `is_suspended = 1` 且 `suspended_until <= now`：自動解除封禁，允許登入。

---

## 6. 前端頁面設計

### 6.1 路由新增

在 `client/src/router` 新增：

```js
{
    path: '/admin',
    name: 'admin',
    component: AdminView,
    meta: { requiresAuth: true, requiresAdmin: true }
}
```

前端 route guard：

- 沒登入：導向 `/login`
- 不是 `admin` 或 `super_admin`：導向首頁或顯示 403

---

### 6.2 新增 AdminView.vue

位置：

```txt
client/src/views/AdminView.vue
```

頁面結構：

```txt
AdminView
├── 上方 tab
│   ├── 處理檢舉
│   └── 成員管理
├── ReportPanel
└── MemberPanel
```

---

### 6.3 主畫面新增紅色管理員按鈕

修改：

```txt
client/src/views/HomeView.vue
```

位置：

- 放在「我的申請」區塊下方。
- 只有 `currentUser.role === 'admin' || currentUser.role === 'super_admin'` 才顯示。

按鈕樣式：

```css
.admin-entry-button {
    width: 100%;
    background: #dc2626;
    color: white;
    border: none;
    border-radius: 12px;
    padding: 12px 16px;
    font-weight: 700;
    cursor: pointer;
}
```

文字：

```txt
管理員專用介面
```

---

### 6.4 處理檢舉畫面

條列式顯示待處理檢舉。

每一筆內容建議顯示：

```txt
檢舉原因：不當言論
檢舉者：王小明 D1234567
被檢舉者：陳大文 D7654321
相關群組：資料庫期末專題
詳細說明：留言內容包含攻擊字眼
時間：2026-06-16 12:00
[處理]
```

按下「處理」後開啟 modal：

第一層選項：

- 不處理
- 處理

如果選「不處理」：

- 輸入備註，可空白。
- 呼叫 `PATCH /api/admin/reports/:id/ignore`。

如果選「處理」：

第二層選項：

- 警告
- 封禁

警告欄位：

- 警告訊息 textarea

封禁欄位：

- 封禁天數 input number
- 永久封禁 checkbox
- 封禁原因 textarea

---

### 6.5 成員管理畫面

條列式或表格顯示所有成員。

從左到右：

| 學號 | 名稱 | email | 身分 | 處罰 |
|---|---|---|---|---|
| D1234567 | 王小明 | a@example.com | user/admin 下拉選單 | 處罰按鈕 |

身分欄位：

```txt
<select>
  <option value="user">user</option>
  <option value="admin">admin</option>
</select>
```

更改後行為：

- 呼叫 `PATCH /api/admin/users/:student_id/role`
- 修改成功後顯示 toast
- 若該使用者是 `super_admin`，select disabled

處罰按鈕：

- 開啟和檢舉處理相同的處罰 modal
- 可選：警告、封禁、解除封禁
- 如果該使用者目前封禁中，顯示「解除封禁」按鈕

---

### 6.6 全站警告顯示

修改：

```txt
client/src/App.vue
```

或放在 `AppHeader.vue` 掛載後檢查。

流程：

1. 使用者登入且有 token。
2. 呼叫 `GET /api/me/warnings`。
3. 若有警告，用 modal 顯示第一筆。
4. 使用者按「我知道了」後呼叫 `DELETE /api/me/warnings/:id`。
5. 若有多筆，依序顯示。

警告視覺：

```txt
系統警告
你因為不當言論被管理員警告，請注意發言。
[我知道了]
```

---

## 7. Group 頁面權限設計

### 7.1 project card 標題可點擊

修改：

```txt
client/src/components/ProjectCard.vue
```

目前主畫面的 project card 標題要改成可點擊：

```vue
<router-link :to="`/groups/${project.id}`" class="project-title-link">
    {{ project.title }}
</router-link>
```

---

### 7.2 一般使用者進入非自己/非成員群組

一般使用者可以點進 group，但畫面限制：

可看：

- 右側詳細資訊
- 專題名稱
- 課程名稱
- 老師
- 需求技能
- 人數
- 聯絡資訊，若原本公開才顯示

不可看：

- 公告
- 倒數
- 群組留言
- 修改按鈕
- 邀請功能
- 成員內部互動功能

建議後端 `/api/groups/:id` 回傳：

```json
{
    "project": {},
    "relation": "guest",
    "can_manage": false,
    "can_view_private_area": false,
    "announcements": [],
    "deadlines": [],
    "comments": []
}
```

---

### 7.3 admin 進入任一群組

admin 權限等同 owner：

```js
canManage = project.owner_id === currentUser.student_id || isAdminRole(currentUser)
canViewPrivateArea = isMember || isOwner || isAdminRole(currentUser)
```

admin 可以：

- 查看公告
- 查看倒數
- 查看留言
- 新增/修改/刪除公告
- 新增/修改/刪除倒數
- 管理留言
- 修改群組資料
- 查看群組內部內容

---

## 8. 後端 group 權限調整

目前後端已有 `groupOrAdminForUser(projectId, userId)` 和 `manageableProjectForUser(projectId, userId)` 的方向，可以延續使用。

建議調整所有群組修改 API：

```js
var project = await manageableProjectForUser(projectId, req.user.student_id);
if (!project || !project.can_manage) {
    res.status(403).json({ message: '沒有權限修改此群組' });
    return;
}
```

不要只判斷：

```js
project.owner_id === req.user.student_id
```

因為 admin 也要能修改。

---

## 9. 安全限制

### 9.1 super_admin 保護

以下操作必須禁止：

- 將 `super_admin` 改成 `user`
- 將 `super_admin` 改成 `admin`
- 封禁 `super_admin`
- 警告 `super_admin`，建議也禁止
- 刪除 `super_admin`

後端必須檢查，不可以只靠前端 disabled。

---

### 9.2 role 只能允許指定值

修改 role 時只能接受：

```js
['user', 'admin']
```

不能讓前端傳 `super_admin`。

---

### 9.3 封禁天數限制

建議：

- 指定天數最少 1 天。
- 最多 365 天。
- 永久封禁用 `ban_days = null`。

---

### 9.4 被封禁者 API 保護

除了 login 檢查，也建議在 auth middleware 後增加：

- 若使用者封禁中，禁止新增留言、申請、建立專題、送出檢舉。
- 只允許登出或讀取基本狀態。

---

## 10. 實作階段規劃

### 階段 1：資料庫與權限基礎

目標：先讓後端有 admin 功能基礎。

要做：

1. `users` 新增：
   - `suspended_until`
   - `suspended_reason`
2. 新增資料表：
   - `reports`
   - `user_warnings`
   - `punishments`
3. 整理 `isAdminRole()`。
4. 新增 `requireAdmin` middleware。
5. 確認 `admin2006` 仍會 seed 成 `super_admin`。

完成標準：

- server 啟動後資料表會自動建立。
- admin2006 登入後 role 是 `super_admin`。
- 一般 user 無法呼叫 `/api/admin/*`。

---

### 階段 2：檢舉送出與 admin 檢舉列表

目標：先讓檢舉能被送出，admin 能看見。

要做：

1. 新增 `POST /api/reports`。
2. 新增 `GET /api/admin/reports`。
3. 前端在留言/個人評價/需要檢舉的位置接上送出檢舉。
4. 新增 `AdminView.vue` 基本頁面。
5. 加上「處理檢舉 / 成員管理」tabs。
6. 先完成檢舉列表，不做處罰 modal。

完成標準：

- user 送出檢舉後，資料進入 `reports`。
- admin 頁面可以看到 pending reports。

---

### 階段 3：檢舉處理功能

目標：admin 可以不處理、警告、封禁。

要做：

1. `PATCH /api/admin/reports/:id/ignore`
2. `PATCH /api/admin/reports/:id/warn`
3. `PATCH /api/admin/reports/:id/ban`
4. 前端處理 modal。
5. 警告寫入 `user_warnings`。
6. 封禁寫入 users 與 `punishments`。

完成標準：

- 不處理後，檢舉不再出現在 pending。
- 警告後，被警告者登入或切頁會看到警告。
- 封禁後，被封禁者無法登入或操作。

---

### 階段 4：全站警告顯示一次

目標：完成警告訊息顯示一次並刪除。

要做：

1. `GET /api/me/warnings`
2. `DELETE /api/me/warnings/:id`
3. 在 `App.vue` 或 `AppHeader.vue` 全站檢查。
4. 顯示警告 modal。
5. 使用者按確認後刪除警告。

完成標準：

- 警告會在主畫面、group 頁面或任意登入後畫面顯示。
- 顯示一次後資料庫刪除，不會重複跳出。

---

### 階段 5：成員管理

目標：完成 admin 成員管理畫面。

要做：

1. `GET /api/admin/users`
2. `PATCH /api/admin/users/:student_id/role`
3. `POST /api/admin/users/:student_id/warn`
4. `POST /api/admin/users/:student_id/ban`
5. `POST /api/admin/users/:student_id/unban`
6. 前端成員列表。
7. role 下拉選單。
8. 處罰 modal。
9. 封禁中顯示解除封禁。

完成標準：

- admin 可以把 user 改成 admin。
- admin 可以把 admin 改回 user。
- admin 不能改 super_admin。
- admin 可以警告、封禁、解除封禁一般使用者。

---

### 階段 6：主畫面 admin 按鈕與 project card 標題連結

目標：讓 admin 入口和 group 快速查看完成。

要做：

1. HomeView「我的申請」下方新增紅色 admin 按鈕。
2. ProjectCard 標題改成可點擊。
3. 一般 user 點標題也能進入 group，但畫面受限。
4. admin 點標題進入任一 group。

完成標準：

- user 看不到 admin 按鈕。
- admin/super_admin 看得到 admin 按鈕。
- project card 標題可以進入 `/groups/:id`。

---

### 階段 7：GroupView 權限重構

目標：一般使用者、成員、owner、admin 看到不同內容。

要做：

1. 後端 group 詳細 API 回傳：
   - `relation`
   - `can_manage`
   - `can_view_private_area`
2. GroupView 根據權限顯示/隱藏區塊。
3. 一般非成員只顯示右側詳細資訊。
4. admin 顯示完整內容並可修改。
5. 所有修改 API 後端都要允許 owner/admin，禁止普通 user。

完成標準：

- 一般 user 進非成員群組看不到公告、倒數、留言。
- admin 進任一群組可看到完整內容。
- admin 可修改任一群組。

---

## 11. 建議檔案修改清單

### 後端

```txt
server/database/db.js
server/middleware/auth.js
server/routes/api.js
```

可能新增：

```txt
server/middleware/admin.js
```

### 前端

```txt
client/src/router/index.js
client/src/views/HomeView.vue
client/src/views/GroupView.vue
client/src/views/AdminView.vue
client/src/components/ProjectCard.vue
client/src/components/AppHeader.vue
client/src/components/ToastMessage.vue
```

可能新增：

```txt
client/src/components/admin/ReportPanel.vue
client/src/components/admin/MemberPanel.vue
client/src/components/admin/PunishmentModal.vue
client/src/components/SystemWarningModal.vue
```

---

## 12. 測試清單

### 12.1 admin 入口

- user 登入，看不到管理員按鈕。
- admin 登入，看得到紅色管理員按鈕。
- super_admin 登入，看得到紅色管理員按鈕。
- user 手動輸入 `/admin`，應該被拒絕。

### 12.2 檢舉

- user 可以送出檢舉。
- admin 可以看到待處理檢舉。
- admin 不處理後，檢舉狀態變 `ignored`。
- admin 警告後，被檢舉者會看到警告。
- admin 封禁後，被檢舉者不能登入或操作。

### 12.3 警告

- 警告訊息在主畫面會跳出。
- 警告訊息在 group 頁也會跳出。
- 按「我知道了」後，資料庫刪除。
- 重新整理後不會再次出現。

### 12.4 成員管理

- admin 可以取得所有成員。
- admin 可以把 user 改成 admin。
- admin 可以把 admin 改回 user。
- admin 不可以修改 super_admin。
- admin 可以封禁 user。
- admin 可以解除封禁 user。

### 12.5 Group 權限

- 一般 user 點非自己群組，只看到右側詳細資訊。
- 一般 user 看不到公告、倒數、留言。
- owner 可以完整管理自己的群組。
- admin 可以完整管理任一群組。
- super_admin 可以完整管理任一群組。

---

## 13. 目前不需要再確認的地方

依照現有需求與專案結構，以下可以直接實作，不需要再問：

- admin 頁面採用獨立 `/admin` 路由。
- role 使用現有 `user`、`admin`、`super_admin`。
- super_admin 固定保留 `admin2006`。
- 警告用資料表儲存，顯示一次後刪除。
- 封禁用 `users.is_suspended` 搭配 `suspended_until`。
- admin 視為和 owner 一樣可以管理任一群組。

---

## 14. 實作優先順序總結

建議不要一次大改，照下面順序做：

1. 先做資料表與 admin middleware。
2. 再做檢舉送出與 admin 檢舉列表。
3. 再做檢舉處理、警告、封禁。
4. 再做全站警告顯示一次。
5. 再做成員管理。
6. 再做主畫面 admin 按鈕與 project card 標題連結。
7. 最後重構 GroupView 權限。

這樣每個階段都可以單獨測試，比較不容易一次改壞整個專案。
