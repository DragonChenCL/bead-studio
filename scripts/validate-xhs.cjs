const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(process.argv[2] || 'dist');
const summaryPath = path.resolve(process.argv[3] || 'validation-summary.txt');
const allowed = new Set(['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.woff', '.woff2', '.json']);
const errors = [];
const warnings = [];

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  console.error(`ERROR: artifact directory not found: ${root}`);
  process.exit(2);
}

const files = walk(root);
const index = path.join(root, 'index.html');
if (!fs.existsSync(index)) errors.push('index.html is not at artifact root');

const htmlFiles = files.filter((file) => path.extname(file).toLowerCase() === '.html');
if (htmlFiles.length !== 1 || rel(htmlFiles[0] || '') !== 'index.html') errors.push('artifact must contain exactly one root index.html');

for (const file of files) {
  const name = rel(file);
  const ext = path.extname(file).toLowerCase();
  if (!allowed.has(ext)) errors.push(`${name}: unsupported file type ${ext || '(none)'}`);
  if (name.split('/').some((part) => part === 'node_modules' || part === '.git' || part === '.DS_Store')) errors.push(`${name}: development artifact is forbidden`);
  if (name.endsWith('.map')) errors.push(`${name}: source maps are forbidden`);
}

if (fs.existsSync(index)) {
  const html = fs.readFileSync(index, 'utf8');
  if (!/^<!DOCTYPE html>/i.test(html.trimStart())) errors.push('index.html: missing doctype');
  if (!/<html[^>]+lang="zh-CN"/i.test(html)) errors.push('index.html: lang="zh-CN" missing');
  if (!/<meta[^>]+charset="?UTF-8"?/i.test(html)) errors.push('index.html: UTF-8 charset missing');
  if (!/<meta[^>]+name="viewport"[^>]+width=device-width[^>]+initial-scale=1\.0[^>]+viewport-fit=cover/i.test(html)) errors.push('index.html: viewport baseline incomplete');
  if (/<script(?![^>]+src=)[^>]*>/i.test(html)) errors.push('index.html: inline script is forbidden');
  if (/\son[a-z]+\s*=/i.test(html)) errors.push('index.html: inline event handler is forbidden');
  if (/type=["']module["']/i.test(html)) errors.push('index.html: module scripts are forbidden');
  if (/<base\b/i.test(html)) errors.push('index.html: <base> is forbidden');
  if (/<(?:iframe|object)\b/i.test(html)) errors.push('index.html: iframe/object is forbidden');
  if (/http-equiv=["']Content-Security-Policy["']/i.test(html)) errors.push('index.html: custom CSP meta is forbidden');
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
    const value = match[1];
    if (/^https?:\/\//i.test(value)) errors.push(`index.html: external resource ${value}`);
    if (/^\//.test(value)) errors.push(`index.html: absolute resource path ${value}`);
  }
}

const bannedJs = [
  ['network fetch', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['WebSocket', /\bnew\s+WebSocket\s*\(/],
  ['EventSource', /\bnew\s+EventSource\s*\(/],
  ['RTCPeerConnection', /\bnew\s+RTCPeerConnection\s*\(/],
  ['service worker', /serviceWorker\.register\s*\(/],
  ['geolocation', /navigator\.geolocation\b/],
  ['clipboard', /navigator\.clipboard\b/],
  ['worker', /\bnew\s+(?:Shared)?Worker\s*\(/],
  ['dynamic eval', /\beval\s*\(/],
  ['dynamic Function', /\bnew\s+Function\s*\(/],
  ['WebAssembly', /\bWebAssembly\b/],
  ['window.open', /window\.open\s*\(/],
  ['window.prompt', /window\.prompt\s*\(/],
  ['fullscreen', /requestFullscreen\s*\(/],
  ['download attribute property', /\.download\s*=/],
  ['external navigation', /location\.(?:href\s*=\s*['\"]https?:|assign\s*\(\s*['\"]https?:)/],
];

for (const file of files.filter((file) => path.extname(file).toLowerCase() === '.js')) {
  const name = rel(file);
  const code = fs.readFileSync(file, 'utf8');
  try {
    new vm.Script(code, { filename: name });
  } catch (error) {
    errors.push(`${name}: not valid classic JavaScript: ${error.message}`);
  }
  for (const [label, pattern] of bannedJs) {
    if (pattern.test(code)) errors.push(`${name}: forbidden capability residue: ${label}`);
  }
  if (/\b(?:import|export)\s+(?:\{|\*|default|from|const|let|var|function|class)/.test(code)) errors.push(`${name}: ESM import/export residue`);
  if (/\.replaceChildren\s*\(/.test(code)) errors.push(`${name}: replaceChildren requires a compatibility fallback`);
  if (/\.text\s*\(\)/.test(code)) warnings.push(`${name}: .text() found; verify it is not File.text() on Chrome 61`);
}

for (const file of files.filter((file) => path.extname(file).toLowerCase() === '.css')) {
  const name = rel(file);
  const css = fs.readFileSync(file, 'utf8');
  if (/url\(\s*["']?https?:\/\//i.test(css)) errors.push(`${name}: external CSS resource URL`);
  for (const feature of ['gap:', 'aspect-ratio:', 'clamp(', 'dvh', 'backdrop-filter', ':focus-visible']) {
    if (css.includes(feature)) warnings.push(`${name}: modern CSS feature present (${feature}); xhs-compat.css baseline must remain bundled`);
  }
}

const lines = [
  '# Xiaohongshu mini-tool validation summary',
  `Artifact: ${root}`,
  `Files: ${files.length}`,
  `Errors: ${errors.length}`,
  `Warnings: ${warnings.length}`,
  '',
  ...errors.map((item) => `ERROR: ${item}`),
  ...warnings.map((item) => `WARN: ${item}`),
  '',
  errors.length ? 'FAILED' : 'PASS',
];
fs.writeFileSync(summaryPath, `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
process.exit(errors.length ? 1 : 0);
