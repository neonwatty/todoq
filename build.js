import { build } from 'esbuild';
import { writeFileSync, readFileSync, chmodSync } from 'fs';

await build({
  entryPoints: ['src/cli/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/cli/index.js',
  format: 'cjs',
  external: ['better-sqlite3']
});

// Add shebang if not present
const content = readFileSync('dist/cli/index.js', 'utf-8');
if (!content.startsWith('#!/usr/bin/env node')) {
  const withShebang = '#!/usr/bin/env node\n' + content;
  writeFileSync('dist/cli/index.js', withShebang);
}

// Make executable
chmodSync('dist/cli/index.js', 0o755);

console.log('Build completed successfully!');