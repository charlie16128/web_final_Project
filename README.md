# TeamUp Campus

TeamUp Campus is split into an Express API server and a Vue 3 + Vite client.

## Project Structure

```text
client/  Vue 3, Vite, Vue Router, Axios
server/  Express API, JWT auth, SQLite database
```

The Express server only serves JSON API routes under `/api`. Frontend routes such as `/`, `/login`, `/register`, and `/groups/:id` are handled by Vue Router in the Vite client.

## 下載專案
```bash
git clone https://github.com/charlie16128/web_final_Project.git
cd web_final_Project
```

## 安裝套件
```bash
npm install
npm run install:all
```

## 注意你需要分別在根目錄、/client、/server 安裝 npm install 才能跑

## 啟動開發環境

Run both apps:

```bash
npm run dev
```

Run only the server:

```bash
npm run server
```

Run only the client:

```bash
npm run client
```

Default URLs:

```text
Server API: http://localhost:3000/api
Client:     http://localhost:5173
```

## Tests

```bash
npm test
```

### 前端打包

```bash
npm run build
```

打包後會產生：

```txt
client/dist/
```

### 啟動後端

```bash
npm run start
```
