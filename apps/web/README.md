# CRM Web MVP

## Local run

1. Start backend API in repo root:

```bash
npm run start:dev
```

2. Start frontend in another terminal:

```bash
npm run web:dev
```

Frontend runs on `http://localhost:5173` and proxies API calls to `http://localhost:3000`.

## Build

```bash
npm run web:build
```
