import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import https from 'https';

const dataDir = join(process.cwd(), 'src/data/monsters');
const imgDir = join(process.cwd(), 'public/monsters');

function downloadImage(url, filepath) {
  return new Promise((resolve) => {
    https.get(url, res => {
      if (res.statusCode !== 200) {
        console.warn(`  Failed ${url}: ${res.statusCode}`);
        resolve(false);
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        writeFileSync(filepath, Buffer.concat(chunks));
        resolve(true);
      });
      res.on('error', () => resolve(false));
    }).on('error', () => resolve(false));
  });
}

function fixCrystals(crystalArr) {
  const fixed = [];
  for (const c of crystalArr) {
    const parts = c.match(/[^\s(]+\(\d+%\)/g);
    if (parts) {
      fixed.push(...parts);
    } else if (c.trim()) {
      fixed.push(c.trim());
    }
  }
  return fixed;
}

async function main() {
  const images = new Map();

  for (const f of readdirSync(dataDir)) {
    if (f === 'index.json') continue;
    const data = JSON.parse(readFileSync(join(dataDir, f), 'utf-8'));
    let modified = false;

    for (const loc of data.locations) {
      for (const m of loc.monsters) {
        if (m.image) {
          const filename = m.image.split('/').pop();
          images.set(filename, m.image);
          m.image = filename;
          modified = true;
        }

        if (m.crystals && m.crystals.length > 0) {
          const fixed = fixCrystals(m.crystals);
          if (JSON.stringify(fixed) !== JSON.stringify(m.crystals)) {
            m.crystals = fixed;
            modified = true;
          }
        }
      }
    }

    if (modified) {
      writeFileSync(join(dataDir, f), JSON.stringify(data, null, 2));
      console.log(`Updated ${f}`);
    }
  }

  console.log(`\nDownloading ${images.size} images...`);
  let downloaded = 0, skipped = 0, failed = 0;

  const entries = [...images.entries()];
  const batchSize = 10;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async ([filename, url]) => {
      const filepath = join(imgDir, filename);
      if (existsSync(filepath)) {
        skipped++;
        return;
      }
      const ok = await downloadImage(url, filepath);
      if (ok) downloaded++;
      else failed++;
    }));

    if ((i + batchSize) % 50 === 0) {
      console.log(`  Progress: ${Math.min(i + batchSize, entries.length)}/${entries.length}`);
    }
  }

  console.log(`\nDone! Downloaded: ${downloaded}, Skipped: ${skipped}, Failed: ${failed}`);
}

main().catch(console.error);
