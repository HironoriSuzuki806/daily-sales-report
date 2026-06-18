import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    // git worktree 環境では Vite のワークスペースルート解決が親リポジトリを指すことが
    // あるため、絶対パスで指定する。
    setupFiles: [path.resolve(__dirname, 'src/test/setup.ts')],
    exclude: ['**/node_modules/**', 'e2e/**', 'tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
