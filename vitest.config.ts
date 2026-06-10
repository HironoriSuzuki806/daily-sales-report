import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    // 絶対パスで指定する。相対パスだとリポジトリ内に作成した git worktree
    // （例: issue-XX/）から実行した際に親リポジトリ側の同名ファイルへ解決されてしまう。
    setupFiles: [path.resolve(__dirname, './src/test/setup.ts')],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
