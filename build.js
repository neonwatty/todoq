import { build } from 'esbuild';
import { writeFileSync, readFileSync, chmodSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// Build the CLI with esbuild
await build({
  entryPoints: ['src/cli/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  outfile: 'dist/cli/index.js',
  format: 'esm',
  external: ['better-sqlite3', 'inquirer', 'chalk', 'ora', 'cli-table3', 'cosmiconfig', 'zod', 'commander', 'execa', 'fs', 'path', 'os']
});

// Generate TypeScript declarations using tsc
console.log('Generating TypeScript declarations...');
try {
  await execAsync('npx tsc --emitDeclarationOnly --outDir dist');
  console.log('TypeScript declarations generated successfully!');
} catch (error) {
  console.warn('Warning: Failed to generate TypeScript declarations:', error.message);
}

// Add shebang if not present
const content = readFileSync('dist/cli/index.js', 'utf-8');
if (!content.startsWith('#!/usr/bin/env node')) {
  const withShebang = '#!/usr/bin/env node\n' + content;
  writeFileSync('dist/cli/index.js', withShebang);
}

// Make executable
chmodSync('dist/cli/index.js', 0o755);

// Copy prompt files to dist
const promptsSrcDir = 'src/services/claude/prompts';
const promptsDistDir = 'dist/services/claude/prompts';

if (existsSync(promptsSrcDir)) {
  // Create prompts directory in dist
  mkdirSync(promptsDistDir, { recursive: true });
  
  // Copy prompt files
  const promptFiles = ['task-execution.md', 'README.md'];
  for (const file of promptFiles) {
    const srcFile = path.join(promptsSrcDir, file);
    const distFile = path.join(promptsDistDir, file);
    if (existsSync(srcFile)) {
      copyFileSync(srcFile, distFile);
      console.log(`Copied prompt file: ${file}`);
    }
  }
}

console.log('Build completed successfully!');