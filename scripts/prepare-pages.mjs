import { copyFileSync, existsSync } from 'node:fs'

if (!existsSync('dist/index.html')) throw new Error('Build output is missing dist/index.html')
copyFileSync('dist/index.html', 'dist/404.html')
console.log('GitHub Pages SPA fallback created.')
