import { checkPort, launch, onInterrupt, requireSuccess, run, untilFirstExit, waitForOutput } from './supervisor.mjs';

/**
 * Temporary internet play from this computer: builds the game, serves it, and opens a Cloudflare quick tunnel to it.
 * Rooms run in the players' browsers and find each other through the production signaling Worker, which accepts
 * quick-tunnel origins, so nothing else runs here.
 */
const port = process.env.PORT || '3219';
/** The built page. The supervisor's own tests point it at a stub folder. */
const dist = process.env.PREVIEW_DIR || 'dist';
onInterrupt('Stopping the build, page server and tunnel…');

await run(async () => {
  const version = await launch('cloudflared', ['--version']).done;
  if (version.error?.code === 'ENOENT') throw new Error('Install cloudflared first: brew install cloudflared (macOS). Other platforms: https://developers.cloudflare.com/tunnel/downloads/');
  if (version.error || version.code !== 0) throw new Error('cloudflared does not run. Reinstall it.');
  await checkPort(port);
  console.log('\nBuilding the game…');
  // npm_execpath is supplied by npm run. Running it with Node avoids a shell wrapper and also works with npm.cmd.
  if (!process.env.npm_execpath) throw new Error('Run this script with npm run tunnel.');
  await requireSuccess(launch(process.execPath, [process.env.npm_execpath, 'run', 'build']), 'Build');
  console.log(`\nServing the game on port ${port}…`);
  const vite = new URL('../node_modules/.bin/vite', import.meta.url).pathname;
  const page = launch(vite, ['preview', '--outDir', dist, '--port', port, '--strictPort', '--host'], { piped: true });
  await waitForOutput(page, `:${port}/`, 'Page server');
  console.log('\nOpening the public tunnel. Share the printed HTTPS URL only with testers.');
  console.log('Open that URL on every device, select Online, and share the room code. Ctrl+C stops everything.\n');
  const tunnel = launch('cloudflared', ['tunnel', '--url', `http://localhost:${port}`]);
  await untilFirstExit([[page, 'Page server'], [tunnel, 'Tunnel']]);
});
