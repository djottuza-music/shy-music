import type { CapacitorConfig } from '@capacitor/cli'

const productionUrl = process.env.CAPACITOR_SERVER_URL || 'https://djottuza-music.github.io/shy-music/'

const config: CapacitorConfig = {
  appId: 'music.shy.app',
  appName: 'SHY Music',
  webDir: 'dist',
  server: { url: productionUrl, cleartext: false },
  android: { allowMixedContent: false },
}

export default config
