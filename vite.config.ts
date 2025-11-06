import { defineConfig } from 'vite';
import { resolve } from 'path';

const REPO_NAME = '/block-ide-vite/';

export default defineConfig({
  base: REPO_NAME,

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ide: resolve(__dirname, 'ide.html'),
        simulation: resolve(__dirname, 'simulation-ide.html'),
        componentEditor: resolve(__dirname, 'component-editor.html'),
      },
    },
  },

  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    fs: {
      allow: ['..'],
    },
  },

  optimizeDeps: {
    include: [
      'monaco-editor/esm/vs/language/json/json.worker',
      'monaco-editor/esm/vs/language/css/css.worker',
      'monaco-editor/esm/vs/language/html/html.worker',
      'monaco-editor/esm/vs/language/typescript/ts.worker',
      'monaco-editor/esm/vs/editor/editor.worker'
    ],
  },
  
});