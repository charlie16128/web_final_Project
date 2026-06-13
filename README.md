# TeamUp Campus

TeamUp Campus is split into an Express API server and a Vue 3 + Vite client.

## Project Structure

```text
client/  Vue 3, Vite, Vue Router, Axios
server/  Express API, JWT auth, SQLite database
```

The Express server only serves JSON API routes under `/api`. Frontend routes such as `/`, `/login`, `/register`, and `/groups/:id` are handled by Vue Router in the Vite client.

## Setup

```bash
npm install
npm run install:all
```

Create environment files from the examples when needed:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

## Development

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
