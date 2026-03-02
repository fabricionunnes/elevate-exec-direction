import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.unvnexus',
  appName: 'UNV Nexus',
  webDir: 'dist',
  server: {
    url: 'https://6b53895e-c5b6-4d6f-8480-0691b85d2fa5.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
};

export default config;
