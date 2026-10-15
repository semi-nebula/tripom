import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pomoharbor.app',
  appName: 'PomoHarbor',
  webDir: 'www',
  backgroundColor: '#0f0e17',
  android: {
    // Keep the WebView below the status bar (no edge-to-edge overlap).
    adjustMarginsForEdgeToEdge: 'auto',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_pomo',
      iconColor: '#8B7CF6',
    },
    // Keep the status bar opaque + dark so the app looks identical to the PWA.
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#0f0e17',
      style: 'dark',
    },
  },
};

export default config;
