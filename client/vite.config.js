/**
 * vite.config.js — הגדרות כלי הבנייה של הלקוח.
 *
 * - React: קומפילציה של JSX ותמיכת Fast Refresh.
 * - Tailwind v4: תוסף Vite רשמי, ללא קובץ postcss.config נפרד.
 * - Proxy: כל בקשה ל-/api מועברת לשרת ה-Express,
 *   כך הדפדפן רואה "מקור" אחד ואין צורך ב-CORS.
 */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // קוראים את PORT מקובץ .env של הפרויקט כדי שהפרוקסי יהיה מסונכרן עם השרת.
  const env = loadEnv(mode, '..', '');
  const apiPort = env.PORT || '3001';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        // 127.0.0.1 במפורש: ב-Windows "localhost" עלול להתפרש כ-::1,
        // בעוד השרת מאזין ל-IPv4 בלבד.
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: false,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
