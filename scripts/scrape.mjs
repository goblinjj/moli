import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import https from 'https';

// All categories from cgs.hk navigation
const CATEGORIES = [
  { id: 'sword', url: 'https://cgs.hk/produce1.htm', label: '鑄劍' },
  { id: 'axe', url: 'https://cgs.hk/produce2.htm', label: '造斧' },
  { id: 'spear', url: 'https://cgs.hk/produce3.htm', label: '造槍' },
  { id: 'bow', url: 'https://cgs.hk/produce4.htm', label: '造弓' },
  { id: 'staff', url: 'https://cgs.hk/produce5.htm', label: '造杖' },
  { id: 'dagger', url: 'https://cgs.hk/produce6.htm', label: '小刀' },
  { id: 'throw', url: 'https://cgs.hk/produce7.htm', label: '投擲武器' },
  { id: 'bomb', url: 'https://cgs.hk/produce8.htm', label: '炸彈' },
  { id: 'helmet', url: 'https://cgs.hk/produce9.htm', label: '頭盔' },
  { id: 'hat', url: 'https://cgs.hk/produce10.htm', label: '帽子' },
  { id: 'armor', url: 'https://cgs.hk/produce11.htm', label: '鎧甲' },
  { id: 'cloth', url: 'https://cgs.hk/produce12.htm', label: '衣服' },
  { id: 'robe', url: 'https://cgs.hk/produce13.htm', label: '長袍' },
  { id: 'boots', url: 'https://cgs.hk/produce14.htm', label: '靴子' },
  { id: 'shoes', url: 'https://cgs.hk/produce15.htm', label: '鞋子' },
  { id: 'shield', url: 'https://cgs.hk/produce16.htm', label: '盾牌' },
  { id: 'cooking', url: 'https://cgs.hk/produce17.htm', label: '料理' },
  { id: 'pharmacy', url: 'https://cgs.hk/produce18.htm', label: '藥品' },
  { id: 'accessory', url: 'https://cgs.hk/produce19.htm', label: '飾品' },
  { id: 'dragon', url: 'https://cgs.hk/produce20.htm', label: '水龍系列' },
  { id: 'fiveC', url: 'https://cgs.hk/produce21.htm', label: '５Ｃ系列' },
  { id: 'scroll', url: 'https://cgs.hk/produce27.htm', label: '變身卷軸' },
  { id: 'collar', url: 'https://cgs.hk/produce22.htm', label: '寵物項圈' },
  { id: 'crystal', url: 'https://cgs.hk/produce23.htm', label: '寵物晶石' },
  { id: 'petArmor', url: 'https://cgs.hk/produce24.htm', label: '寵物裝甲' },
  { id: 'petAccessory', url: 'https://cgs.hk/produce25.htm', label: '寵物飾品' },
  { id: 'petCloth', url: 'https://cgs.hk/produce26.htm', label: '寵物服裝' },
];

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parseLevelVariant(text) {
  // e.g. "1A", "2B", "13C"
  const match = text.match(/^(\d+)([A-Z])$/);
  if (!match) return null;
  return { level: parseInt(match[1]), variant: match[2] };
}

function parseMaterialLevel(title) {
  // e.g. "等級1", "等級12"
  if (!title) return 0;
  const match = title.match(/等級(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

function parsePage(html, categoryId) {
  const $ = cheerio.load(html);
  const recipes = [];

  $('tbody[id]').each((_, tbody) => {
    const rows = $(tbody).find('> tr').toArray();
    if (rows.length < 3) return;

    const row1 = $(rows[0]); // images + quantities
    const row2 = $(rows[1]); // names
    const row3 = $(rows[2]); // type + data-set values

    // Level/variant from first cell
    const lvText = row1.find('td').first().text().trim();
    const parsed = parseLevelVariant(lvText);
    if (!parsed) return;

    const { level, variant } = parsed;
    const id = `${categoryId}-${level}${variant.toLowerCase()}`;

    // Row2 cells: [itemName, mat1Name, mat2Name, ...]
    // (row1's first td has rowspan=3, so row2 doesn't have the level cell)
    const row2Cells = row2.find('td').toArray();
    const itemName = $(row2Cells[0]).text().trim();
    if (!itemName) return;

    // Item image (second cell in row1, index 1)
    const itemImgCell = row1.find('td').eq(1);
    const itemImg = itemImgCell.find('img').attr('data-src') || '';

    // Stats from the last cell with rowspan=3 in row1
    const allCellsRow1 = row1.find('td').toArray();
    const lastCell = $(allCellsRow1[allCellsRow1.length - 1]);
    const stats = lastCell.attr('rowspan') ? lastCell.text().trim().replace(/\s+/g, ' ') : '';

    // MP cost = level * 20
    const mpCost = level * 20;

    // Materials: quantity cells in row1 (class="quantity")
    const materials = [];
    let matIdx = 0;
    for (let i = 2; i < allCellsRow1.length; i++) {
      const cell1 = $(allCellsRow1[i]);
      if (cell1.attr('rowspan')) continue; // skip stats column

      const img = cell1.find('img');
      if (!img.length) { matIdx++; continue; }

      const matImg = img.attr('data-src') || '';
      const matLevel = parseMaterialLevel(img.attr('title'));
      const qtyText = cell1.find('span').text().trim();
      const qtyMatch = qtyText.match(/x\s*(\d+)/);
      const quantity = qtyMatch ? parseInt(qtyMatch[1]) : 0;

      // Material name from row2: cells[1+matIdx]
      const nameCell = row2Cells[1 + matIdx];
      const matName = nameCell ? $(nameCell).text().trim() : '';

      matIdx++;

      if (matName && quantity > 0) {
        materials.push({
          name: matName,
          quantity,
          image: matImg + '.png',
          materialLevel: matLevel,
        });
      }
    }

    if (materials.length === 0) return;

    recipes.push({
      id,
      name: itemName,
      category: categoryId,
      level,
      variant,
      image: itemImg + '.png',
      mpCost,
      stats,
      materials,
    });
  });

  return recipes;
}

async function downloadImage(hash, outputDir) {
  const filename = hash + '.png';
  const filepath = join(outputDir, filename);
  if (existsSync(filepath)) return;

  const prefix = hash.substring(0, 2);
  const url = `https://ig2.cgs.hk/g/${prefix}/${hash}.png`;

  return new Promise((resolve) => {
    https.get(url, res => {
      if (res.statusCode !== 200) {
        console.warn(`  Failed to download ${hash}: ${res.statusCode}`);
        resolve();
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        writeFileSync(filepath, buffer);
        resolve();
      });
      res.on('error', () => resolve());
    }).on('error', () => resolve());
  });
}

async function main() {
  const dataDir = join(process.cwd(), 'src/data');
  const imgDir = join(process.cwd(), 'public/items');
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(imgDir, { recursive: true });

  const allCategories = [];

  for (const cat of CATEGORIES) {
    console.log(`Fetching ${cat.label} (${cat.url})...`);
    try {
      const html = await fetchPage(cat.url);
      const recipes = parsePage(html, cat.id);
      console.log(`  Found ${recipes.length} recipes`);

      if (recipes.length === 0) continue;

      // Save JSON
      const jsonPath = join(dataDir, `${cat.id}.json`);
      writeFileSync(jsonPath, JSON.stringify(recipes, null, 2));

      // Collect all image hashes to download
      const hashes = new Set();
      for (const recipe of recipes) {
        hashes.add(recipe.image.replace('.png', ''));
        for (const mat of recipe.materials) {
          hashes.add(mat.image.replace('.png', ''));
        }
      }

      console.log(`  Downloading ${hashes.size} images...`);
      const batchSize = 10;
      const hashArray = [...hashes];
      for (let i = 0; i < hashArray.length; i += batchSize) {
        const batch = hashArray.slice(i, i + batchSize);
        await Promise.all(batch.map(h => downloadImage(h, imgDir)));
      }

      allCategories.push({ id: cat.id, label: cat.label, count: recipes.length });
    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }

    // Small delay between pages
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n=== Summary ===');
  for (const cat of allCategories) {
    console.log(`${cat.label} (${cat.id}): ${cat.count} recipes`);
  }
}

main().catch(console.error);
