import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const buildId = (env.VITE_BUILD_ID || process.env.GITHUB_SHA || 'dev').slice(0, 7)
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    define: { __SHY_VERSION__: JSON.stringify(`1.0.0+${buildId}`) },
    build: { sourcemap: true },
  }
})
