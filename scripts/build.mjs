import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

async function filesUnder(directory) {
  const entries = await readdir(directory, {withFileTypes:true});
  const files = await Promise.all(entries.map(entry => entry.isDirectory() ? filesUnder(join(directory, entry.name)) : join(directory, entry.name)));
  return files.flat().sort();
}

export async function buildSite(root = fileURLToPath(new URL('../', import.meta.url))) {
  const pages = ['index.html', 'anniversary.html'].map(page => join(root, page));
  const assets = await filesUnder(join(root, 'assets'));
  const inputs = [...pages, ...assets, ...await filesUnder(join(root, 'api')), join(root, 'vercel.json'), join(root, 'scripts/build.mjs')].sort();
  const hash = createHash('sha256');
  for (const file of inputs) hash.update(relative(root, file).replaceAll('\\', '/')).update('\0').update(await readFile(file)).update('\0');
  const version = hash.digest('hex').slice(0, 16);
  const output = join(root, 'public');
  const stamp = text => text.replace(/(["'])((?:\/assets\/|\.\.?\/)[^"'\s?]+\.(?:js|css|json))\1/g, `$1$2?v=${version}$1`);
  for (const file of [...pages, ...assets]) {
    const target = join(output, relative(root, file));
    await mkdir(dirname(target), {recursive:true});
    let content = await readFile(file);
    if (['.html','.js','.css','.json'].includes(extname(file))) {
      content = stamp(content.toString('utf8')).replace('<meta name="app-version" content="development">', `<meta name="app-version" content="${version}">`);
    }
    await writeFile(target, content);
  }
  await writeFile(join(output, 'version.json'), JSON.stringify({version}));
  return {version, output};
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const {version} = await buildSite();
  console.log(`Built site version ${version}`);
}
