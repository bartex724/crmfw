var _a;
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
var backendTarget = (_a = process.env.VITE_BACKEND_PROXY_TARGET) !== null && _a !== void 0 ? _a : 'http://localhost:3000';
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/auth': backendTarget,
            '/inventory': backendTarget,
            '/events': backendTarget,
            '/boxes': backendTarget,
            '/health': backendTarget,
            '/api': backendTarget
        }
    }
});
