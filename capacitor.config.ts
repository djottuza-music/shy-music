import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'music.shy.app',
  appName: 'SHY Music',
  webDir: 'dist',
  server: {
    url: 'https://djottuza-music.github.io/shy-music/',
    cleartext: false,
  },
  android: { allowMixedContent: false },
}

export default config
