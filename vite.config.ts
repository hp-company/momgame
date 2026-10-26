import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 같은 Wi-Fi의 태블릿/폰에서 접속 (카메라는 localhost 또는 HTTPS에서만 허용)
    port: 5173,
  },
});
