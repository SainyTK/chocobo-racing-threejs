import { checkPort, launch, onInterrupt, run, untilFirstExit } from './supervisor.mjs';

/** Local development: the page with Vite hot reload, and the signaling Worker under Wrangler with local state. */
const port = process.env.PORT || '3000';
const signalPort = process.env.SIGNAL_PORT || '8787';
onInterrupt('Stopping the page and the signaling Worker…');

await run(async () => {
  await checkPort(port); await checkPort(signalPort);
  const bin = name => new URL(`../node_modules/.bin/${name}`, import.meta.url).pathname;
  const signal = launch(bin('wrangler'), ['dev', '--config', 'signaling/wrangler.jsonc', '--port', signalPort, '--local', '--persist-to', 'output/wrangler-state/dev', '--show-interactive-dev-session=false'], { group: 'shared' });
  const page = launch(bin('vite'), ['--port', port, '--strictPort', '--host'], { env: { ...process.env, VITE_SIGNAL_URL: `http://localhost:${signalPort}` }, group: 'shared' });
  await untilFirstExit([[signal, 'Signaling Worker'], [page, 'Page']]);
});
