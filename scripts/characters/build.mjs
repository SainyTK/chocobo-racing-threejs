// `npm run character -- <name>`: rebuilds src/assets/characters/<name>.glb from scripts/characters/<name>/ in headless Blender.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const name = process.argv[2];
if (!name || !existsSync(fileURLToPath(new URL(`./${name}/model.py`, import.meta.url)))) { console.error('Usage: npm run character -- <name>, with scripts/characters/<name>/model.py'); process.exit(1); }
const blender = process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
const out = fileURLToPath(new URL(`../../src/assets/characters/${name}.glb`, import.meta.url));
const run = spawnSync(blender, ['-b', '--factory-startup', '--python-exit-code', '1', '-P', fileURLToPath(new URL('./build.py', import.meta.url)), '--', name, out], { encoding: 'utf8' });
if (run.error) { console.error(`Could not start Blender at ${blender}. Set BLENDER to its executable.`); process.exit(1); }
const lines = `${run.stdout}${run.stderr}`.split('\n');
for (const line of lines) if (/^BUILD |Error|Traceback/.test(line)) console.log(line);
if (run.status !== 0) { console.error(lines.slice(-30).join('\n')); process.exit(run.status ?? 1); }
