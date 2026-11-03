/**
 * 生成腾讯云云函数发布包。
 *
 *   node scripts/build-cloud-function.mjs
 *
 * 产物：
 *   dist/cloud-function/      可直接在控制台上传的目录
 *   dist/cloud-function.zip   上传用的压缩包
 *
 * 特点：
 *  - 只按白名单复制（index.js / app.mjs / lib / knowledge），不会把 .env 打进去
 *  - lib/*.js 复制为 *.mjs 并改写相对导入后缀，交给 CJS 入口动态 import
 *  - knowledge 目录随包上传，运行时可正常读到 8 份资料
 */

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = join(ROOT, 'dist', 'cloud-function');
const ZIP = join(ROOT, 'dist', 'cloud-function.zip');

function rewriteImports(code) {
  return code.replace(/(from\s+['"])(\.\/[^'"]+)\.js(['"])/g, '$1$2.mjs$3');
}

function main() {
  if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, 'lib'), { recursive: true });
  mkdirSync(join(OUT, 'knowledge'), { recursive: true });

  // 1. CJS 入口 + ESM 业务层薄封装
  cpSync(join(ROOT, 'cloud', 'index.js'), join(OUT, 'index.js'));
  cpSync(join(ROOT, 'cloud', 'app.mjs'), join(OUT, 'app.mjs'));

  // 2. lib/*.js -> lib/*.mjs
  const libFiles = readdirSync(join(ROOT, 'lib')).filter((f) => f.endsWith('.js'));
  for (const file of libFiles) {
    const code = readFileSync(join(ROOT, 'lib', file), 'utf8');
    writeFileSync(join(OUT, 'lib', file.replace(/\.js$/, '.mjs')), rewriteImports(code), 'utf8');
  }

  // 3. 知识库（只复制 md，绝不复制 .env）
  const mdFiles = readdirSync(join(ROOT, 'knowledge')).filter((f) => f.endsWith('.md'));
  for (const file of mdFiles) {
    cpSync(join(ROOT, 'knowledge', file), join(OUT, 'knowledge', file));
  }

  // 4. 云函数包自身的 package.json（无 type: module，保证 CJS 入口可被 require）
  writeFileSync(
    join(OUT, 'package.json'),
    JSON.stringify(
      {
        name: 'gf-twin-cloud-function',
        version: '1.0.0',
        private: true,
        description: 'gf 个人主页数字分身 · 腾讯云云函数版本',
        main: 'index.js',
        engines: { node: '>=18' },
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  // 5. 打包
  // 注意：PowerShell 的 Compress-Archive 在 PS 5.1 下会把路径写成反斜杠，
  // 腾讯云用 Go 解压会直接报 "zip code format error"，所以改用 bsdtar。
  if (existsSync(ZIP)) rmSync(ZIP, { force: true });
  execFileSync(
    'tar.exe',
    ['-a', '-c', '-f', ZIP, '-C', OUT, 'index.js', 'app.mjs', 'package.json', 'lib', 'knowledge'],
    { stdio: 'inherit' }
  );

  const files = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else files.push([full.replace(OUT + '\\', '').replace(OUT + '/', ''), statSync(full).size]);
    }
  })(OUT);

  console.log(`发布目录: ${OUT}`);
  console.log(`压缩包:   ${ZIP} (${(statSync(ZIP).size / 1024).toFixed(1)} KB)`);
  console.log(`文件数:   ${files.length}`);
  for (const [name, size] of files.sort()) {
    console.log(`  ${name.padEnd(34, ' ')} ${(size / 1024).toFixed(1)} KB`);
  }
}

main();
