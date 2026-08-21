/**
 * Start Expo for the Android emulator with device-visible local hosts.
 *
 * Android's emulator maps the host Mac to 10.0.2.2. Override
 * EXPO_PUBLIC_DEV_HOST for a physical device and
 * EXPO_PUBLIC_ANDROID_SUPABASE_URL when using a hosted/non-local project.
 */

import { spawn } from 'node:child_process';

const devHost = process.env.EXPO_PUBLIC_DEV_HOST?.trim() || '10.0.2.2';
const supabaseUrl =
  process.env.EXPO_PUBLIC_ANDROID_SUPABASE_URL?.trim() ||
  `http://${devHost}:54321`;
const metroPort = process.env.SUBBY_METRO_PORT?.trim() || '8081';
const npmCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const child = spawn(
  npmCommand,
  ['expo', 'start', '--android', '--go', '--host', 'lan', '--port', metroPort],
  {
    env: {
      ...process.env,
      EXPO_PUBLIC_DEV_HOST: devHost,
      EXPO_PUBLIC_SUPABASE_URL: supabaseUrl,
      SUBBY_METRO_PORT: metroPort,
    },
    stdio: 'inherit',
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exit(code ?? 1);
});
