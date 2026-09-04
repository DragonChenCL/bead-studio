const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, '.tmp-core-test');
fs.rmSync(out, { recursive: true, force: true });

execFileSync('tsc', [
  'src/core/palette.ts',
  'src/core/types.ts',
  'src/core/engine.ts',
  'src/core/inventory.ts',
  'src/core/purchase.ts',
  '--outDir', '.tmp-core-test',
  '--module', 'commonjs',
  '--target', 'es2020',
  '--skipLibCheck',
  '--esModuleInterop',
], { cwd: root, stdio: 'inherit' });
fs.writeFileSync(path.join(out, 'package.json'), '{"type":"commonjs"}\n');

try {
  require(path.join(root, 'tests/core.cjs'));
} finally {
  fs.rmSync(out, { recursive: true, force: true });
}
