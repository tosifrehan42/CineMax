import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.vertexstudios.cinemax',
  appName: 'CineMax',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
