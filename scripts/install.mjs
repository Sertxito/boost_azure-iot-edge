#!/usr/bin/env node
// Standalone boost installer. No external dependencies, no runtime required.
// Copies agents, skills, prompts and instructions to locations that GitHub Copilot / VS Code auto-discover:
//   .github/agents/<prefix>-*.agent.md      .github/skills/<prefix>-*/SKILL.md  (+ .agents/skills/)
//   .github/prompts/<prefix>-*.prompt.md    .github/instructions/<prefix>-*.instructions.md
//   .github/copilot-instructions.md         (or <prefix>-global.instructions.md if the project already has one)
// Every asset gets the boost prefix (package.json "boostPrefix") so several boosts coexist without collisions;
// internal cross-references are rewritten accordingly. Existing files are never overwritten (unless --force)
// and every ignored file is reported.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'));
const prefix = pkg.boostPrefix ?? pkg.name.replace(/^boost[-_]/, '');
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };

if (flag('help') || flag('h')) {
  console.log(`${pkg.name} installer (prefix "${prefix}-")
Usage: npx ${pkg.name} [--target <dir>] [--force] [--dry-run] [--no-agents-dir] [--uninstall] [--check]
  --target <dir>   project to install into (default: current directory)
  --force          overwrite existing files
  --dry-run        show what would happen
  --no-agents-dir  do not mirror skills into .agents/skills
  --uninstall      remove files installed by this boost (uses manifest)
  --check          verify the installed files exist and are valid`);
  process.exit(0);
}

const target = path.resolve(opt('target') ?? process.cwd());
const dry = flag('dry-run');
const force = flag('force');
const manifestPath = path.join(target, '.github', `.boost-${pkg.name.replace(/[^\w.-]/g, '_')}.manifest.json`);
const src = (n) => [path.join(pkgRoot, n), path.join(pkgRoot, '.github', n)].find(fs.existsSync);
const readManifest = () => (fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')).files : []);
const norm = (p) => p.split(path.sep).join('/');

if (flag('uninstall')) {
  if (!fs.existsSync(manifestPath)) { console.error('No manifest found; nothing to uninstall.'); process.exit(1); }
  for (const f of readManifest()) { const p = path.join(target, f); console.log(`${dry ? '[dry] ' : ''}remove ${f}`); if (!dry && fs.existsSync(p)) fs.rmSync(p); }
  if (!dry) fs.rmSync(manifestPath);
  process.exit(0);
}

const pre = (n) => (n.startsWith(`${prefix}-`) ? n : `${prefix}-${n}`);
const EXT = { agents: '.agent.md', prompts: '.prompt.md', instructions: '.instructions.md' };
const list = (kind) => { const d = src(kind); return d ? fs.readdirSync(d).filter((n) => n.endsWith(EXT[kind])).map((n) => ({ dir: d, file: n, base: n.slice(0, -EXT[kind].length) })) : []; };
const skillDirs = () => { const d = src('skills'); return d ? fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory() && fs.existsSync(path.join(d, e.name, 'SKILL.md'))).map((e) => ({ dir: path.join(d, e.name), name: e.name })) : []; };
function* walk(dir, base = '') {
  for (const e of fs.readdirSync(path.join(dir, base), { withFileTypes: true })) {
    const rel = path.join(base, e.name);
    if (e.isDirectory()) yield* walk(dir, rel); else yield rel;
  }
}

const agents = list('agents'), prompts = list('prompts'), instructions = list('instructions'), skills = skillDirs();
const names = [...new Set([...agents, ...prompts, ...instructions].map((a) => a.base).concat(skills.map((s) => s.name)))]
  .filter((n) => pre(n) !== n).sort((a, b) => b.length - a.length);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alt = (arr) => arr.map(esc).join('|');
const multi = names.filter((n) => n.includes('-')), single = names.filter((n) => !n.includes('-'));
const rules = [];
if (names.length) {
  rules.push([new RegExp(`((?:skills|agents|prompts|instructions)/)(${alt(names)})(?![\\w-])`, 'g'), (_, d, n) => d + pre(n)]);
  if (multi.length) rules.push([new RegExp(`(?<![\\w/.\\-])(${alt(multi)})(?![\\w-])`, 'g'), (_, n) => pre(n)]);
  if (single.length) {
    const s = alt(single);
    rules.push([new RegExp(`([\`'"@])(${s})(?=[\`'"\\s,.;:)\\]]|$)`, 'g'), (_, q, n) => q + pre(n)]);
    rules.push([new RegExp(`((?:^|[\\s(])\\/)(${s})(?![\\w/\\-.])`, 'gm'), (_, q, n) => q + pre(n)]);
    rules.push([new RegExp(`(^\\s*(?:name|agent):\\s*)(${s})\\s*$`, 'gm'), (_, q, n) => q + pre(n)]);
  }
}
const rewrite = (text) => rules.reduce((t, [re, fn]) => t.replace(re, fn), text);

const plan = []; // {from,to,text?}
const add = (from, to, isText) => plan.push({ from, to, text: isText ? rewrite(fs.readFileSync(from, 'utf8')) : undefined });
for (const kind of Object.keys(EXT)) for (const a of list(kind)) add(path.join(a.dir, a.file), path.join(target, '.github', kind, pre(a.base) + EXT[kind]), true);
for (const s of skills) for (const rel of walk(s.dir)) {
  const isMd = rel.endsWith('.md');
  add(path.join(s.dir, rel), path.join(target, '.github', 'skills', pre(s.name), rel), isMd);
  if (!flag('no-agents-dir')) add(path.join(s.dir, rel), path.join(target, '.agents', 'skills', pre(s.name), rel), isMd);
}

const ci = src('copilot-instructions.md') ?? [path.join(pkgRoot, '.github', 'copilot-instructions.md')].find(fs.existsSync);
const ciTarget = path.join(target, '.github', 'copilot-instructions.md');
const ownManifest = readManifest().map(norm);
const ciIsOurs = ownManifest.includes('.github/copilot-instructions.md');
if (ci) {
  if (!fs.existsSync(ciTarget) || ciIsOurs || force) add(ci, ciTarget, true);
  else {
    let body = rewrite(fs.readFileSync(ci, 'utf8'));
    if (!/^---\s*\n/.test(body)) body = `---\ndescription: Global guidance from ${pkg.name}\napplyTo: "**"\n---\n\n${body}`;
    plan.push({ from: ci, to: path.join(target, '.github', 'instructions', `${prefix}-global.instructions.md`), text: body });
  }
}

if (flag('check')) {
  const m = ownManifest.length ? ownManifest : plan.map((p) => norm(path.relative(target, p.to)));
  const missing = m.filter((f) => !fs.existsSync(path.join(target, f)));
  const count = (g) => m.filter(g).length;
  console.log(`${pkg.name}: agents=${count((f) => /^\.github\/agents\/.+\.agent\.md$/.test(f))} skills=${count((f) => /^\.github\/skills\/[^/]+\/SKILL\.md$/.test(f))} prompts=${count((f) => f.endsWith('.prompt.md'))} instructions=${count((f) => f.endsWith('.instructions.md'))}`);
  if (missing.length) { console.error(`Missing ${missing.length} files, e.g. ${missing[0]}`); process.exit(1); }
  console.log('OK: all installed files present.'); process.exit(0);
}

const written = [], ownSkipped = [], ignored = [];
for (const p of plan) {
  const rel = norm(path.relative(target, p.to));
  if (fs.existsSync(p.to) && !force) {
    if (ownManifest.includes(rel)) ownSkipped.push(rel);
    else ignored.push(rel);
    continue;
  }
  if (!dry) {
    fs.mkdirSync(path.dirname(p.to), { recursive: true });
    if (p.text !== undefined) fs.writeFileSync(p.to, p.text); else fs.copyFileSync(p.from, p.to);
  }
  written.push(rel);
}

if (!dry && written.length) {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify({ package: pkg.name, version: pkg.version, prefix, files: [...new Set([...ownManifest, ...written])] }, null, 2));
}

if (ignored.length) {
  console.warn(`\n[WARN] ${ignored.length} file(s) already existed in the target and were IGNORED (not overwritten):`);
  const byTop = new Map();
  for (const f of ignored) { const k = f.split('/').slice(0, f.startsWith('.github/skills') || f.startsWith('.agents/skills') ? 3 : 3).join('/'); byTop.set(k, (byTop.get(k) ?? 0) + 1); }
  for (const [k, n] of byTop) console.warn(`  - ${k}${n > 1 ? ` (${n} files)` : ''}`);
  console.warn('  Use --force to overwrite them.\n');
}
console.log(`${dry ? '[dry-run] ' : ''}${pkg.name}@${pkg.version}: ${written.length} installed, ${ownSkipped.length} already installed by this boost, ${ignored.length} ignored (pre-existing) -> ${target}`);
console.log('Reload VS Code (Developer: Reload Window) so Copilot picks up agents, skills, prompts and instructions.');
