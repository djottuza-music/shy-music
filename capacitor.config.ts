import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'music.shy.app',
  appName: 'SHY Music',
  webDir: 'dist',
  android: { allowMixedContent: false },
}

export default config
