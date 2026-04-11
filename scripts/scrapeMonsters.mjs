import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import https from 'https';

const BASE_URL = 'https://cgsword.com';

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const handler = (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${BASE_URL}${res.headers.location}`;
        https.get(redirectUrl, handler).on('error', reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    };
    https.get(url, handler).on('error', reject);
  });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Collect ALL unique location hrefs from the entire menu
function collectAllLocations(html) {
  const $ = cheerio.load(html);
  const locations = new Map();
  $('#menuroot a[href^="/bm/"]').each((_, el) => {
    const href = $(el).attr('href');
    const name = $(el).text().trim();
    if (href && name) {
      const id = href.replace('/bm/', '').split('-')[0];
      if (!locations.has(href)) {
        locations.set(href, { id, name, href });
      }
    }
  });
  return [...locations.values()];
}

function parseElements(text) {
  const elements = { earth: 0, water: 0, fire: 0, wind: 0 };
  const earthMatch = text.match(/地(\d+)/);
  const waterMatch = text.match(/水(\d+)/);
  const fireMatch = text.match(/火(\d+)/);
  const windMatch = text.match(/風(\d+)/);
  if (earthMatch) elements.earth = parseInt(earthMatch[1]);
  if (waterMatch) elements.water = parseInt(waterMatch[1]);
  if (fireMatch) elements.fire = parseInt(fireMatch[1]);
  if (windMatch) elements.wind = parseInt(windMatch[1]);
  return elements;
}

function fixCrystals(crystalArr) {
  const fixed = [];
  for (const c of crystalArr) {
    const parts = c.match(/[^\s(]+\(\d+%\)/g);
    if (parts) fixed.push(...parts);
    else if (c.trim()) fixed.push(c.trim());
  }
  return fixed;
}

function parseMonsters($, $section) {
  const monsters = [];
  $section.find('.beastCell').each((_, cellDiv) => {
    const $cell = $(cellDiv);
    const $container = $cell.parent();

    const nameLink = $container.find('a[href^="/bm/"]');
    let name = nameLink.text().trim();
    if (!name) {
      const nameDiv = $container.find('div[style*="text-align:center"]');
      name = nameDiv.text().trim();
    }
    if (!name) return;

    const $info = $container.next();
    if (!$info.length) return;

    const infoText = $info.text();

    const levelMatch = infoText.match(/Lv(\d+)(?:-(\d+))?/);
    const levelMin = levelMatch ? parseInt(levelMatch[1]) : 0;
    const levelMax = levelMatch ? parseInt(levelMatch[2] || levelMatch[1]) : 0;

    const elemSpans = $info.find('span.earth, span.water, span.fire, span.wind');
    let elemText = '';
    elemSpans.each((_, el) => { elemText += $(el).text(); });
    const elements = parseElements(elemText);

    const typeMatch = infoText.match(/([\u4e00-\u9fff]+系)\(([^)]+)\)/);
    let type = typeMatch ? typeMatch[1] : '';
    let typeDetail = typeMatch ? typeMatch[2] : '';
    if (!type) {
      const simpleTypeMatch = infoText.match(/([\u4e00-\u9fff]+系)/);
      if (simpleTypeMatch) type = simpleTypeMatch[1];
    }

    const cardMatch = infoText.match(/卡片:\s*([^\s　]+(?:普卡)?)/);
    const cardGrade = cardMatch ? cardMatch[1].trim() : '';

    const sealable = $info.find('span.catch').length > 0;
    const isBoss = $cell.hasClass('expand');

    const imageDiv = $cell.find('.imageparty, .beastImg');
    let image = '';
    let frameWidth = 0;
    let frameHeight = 0;
    let frameCount = 1;
    let animTime = 1000;

    if (imageDiv.length) {
      const bgStyle = imageDiv.attr('style') || '';
      const imgMatch = bgStyle.match(/url\(([^)]+)\)/);
      if (imgMatch) {
        image = imgMatch[1].replace(/^\/\//, 'https://').replace(/['"]/g, '');
      }
      const wMatch = bgStyle.match(/width:(\d+)px/);
      const hMatch = bgStyle.match(/height:(\d+)px/);
      if (wMatch) frameWidth = parseInt(wMatch[1]);
      if (hMatch) frameHeight = parseInt(hMatch[1]);

      const fc = imageDiv.attr('data-frame');
      const at = imageDiv.attr('data-time');
      if (fc) frameCount = parseInt(fc);
      if (at) animTime = parseInt(at);
    }

    monsters.push({
      name, levelMin, levelMax,
      ...elements,
      type, typeDetail, cardGrade, sealable, isBoss,
      image, frameWidth, frameHeight, frameCount, animTime,
    });
  });
  return monsters;
}

function parseLocationPage(html) {
  const $ = cheerio.load(html);

  // Parse breadcrumb
  const breadcrumbLinks = [];
  const firstPath = $('div.path').first();
  firstPath.find('a[itemprop="url"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const title = $(el).find('span[itemprop="title"]').text().trim() || $(el).text().trim();
    if (href && title) {
      breadcrumbLinks.push({ href, name: title });
    }
  });

  // Parse encounter groups (yellow sections)
  const groups = [];

  $('div[style*="background:#FFFFDD"]').each((_, section) => {
    const $section = $(section);

    // Check for header label (could be BOSS or area name)
    const headerDiv = $section.find('div[style*="position: absolute"][style*="margin-top: -34px"]');
    let headerText = headerDiv.length ? headerDiv.text().trim() : '';
    const isBoss = headerText.startsWith('BOSS');

    // If it's a named area (not BOSS, not empty), use it as area name
    let areaName = '';
    if (headerText && !isBoss) {
      areaName = headerText;
    }

    const infoBox = $section.find('div[style*="background-color: #FFE"]');
    let encounterCount = '';
    let crystals = [];

    if (infoBox.length) {
      const infoText = infoBox.text();
      const countMatch = infoText.match(/出現數量:\s*(\d+-\d+)隻/);
      if (countMatch) encounterCount = countMatch[1];

      const crystalMatch = infoText.match(/建議水晶:\s*(.*)/);
      if (crystalMatch) {
        crystals = fixCrystals(crystalMatch[1].trim().split(/\s+/).filter(c => c && c.includes('(')));
      }
    }

    const monsters = parseMonsters($, $section);

    if (monsters.length > 0) {
      groups.push({ areaName, encounterCount, crystals, isBoss, monsters });
    }
  });

  // Check if this page has named sub-areas (island overview pages)
  const hasNamedAreas = groups.some(g => g.areaName && !g.isBoss);

  if (hasNamedAreas) {
    // Return multiple areas - each named group + attach boss groups to previous area
    const resultAreas = [];
    let currentArea = null;

    for (const group of groups) {
      if (group.areaName && !group.isBoss) {
        currentArea = {
          name: group.areaName,
          crystals: group.crystals,
          encounterCount: group.encounterCount,
          monsters: [...group.monsters],
        };
        resultAreas.push(currentArea);
      } else if (group.isBoss && currentArea) {
        currentArea.monsters.push(...group.monsters);
      } else if (!group.areaName && !group.isBoss) {
        // Unnamed non-boss group before any named area
        currentArea = {
          name: '',
          crystals: group.crystals,
          encounterCount: group.encounterCount,
          monsters: [...group.monsters],
        };
        resultAreas.push(currentArea);
      }
    }

    return { breadcrumb: breadcrumbLinks, multiArea: true, areas: resultAreas };
  }

  // Single area page - merge all groups
  const allMonsters = [];
  let mainCrystals = [];
  let mainEncounterCount = '';

  for (const group of groups) {
    allMonsters.push(...group.monsters);
    if (!group.isBoss && group.crystals.length > 0 && mainCrystals.length === 0) {
      mainCrystals = group.crystals;
    }
    if (!group.isBoss && group.encounterCount && !mainEncounterCount) {
      mainEncounterCount = group.encounterCount;
    }
  }

  return {
    breadcrumb: breadcrumbLinks,
    multiArea: false,
    crystals: mainCrystals,
    encounterCount: mainEncounterCount,
    monsters: allMonsters,
  };
}

function slugify(name) {
  const map = {
    '芙蕾雅島': 'fureya', '索奇亞島': 'sochia', '莎蓮娜島': 'shalena',
    '米內葛爾島': 'minegl', '庫魯克斯島': 'kruks', '德威特島': 'dewitt',
    '傑諾姆島': 'genom', '弗利德島': 'fried', '樂園之卵': 'paradise',
    '辛梅爾': 'simmel', '諾斯菲拉特': 'nospherat', '哈那可半島': 'hanako',
    '逆星': 'gyaku', '日耀之域': 'nichiyo', '水曜之域': 'suiyo',
  };
  return map[name] || name;
}

function downloadImage(url, filepath) {
  return new Promise((resolve) => {
    https.get(url, res => {
      if (res.statusCode !== 200) { resolve(false); return; }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => { writeFileSync(filepath, Buffer.concat(chunks)); resolve(true); });
      res.on('error', () => resolve(false));
    }).on('error', () => resolve(false));
  });
}

async function main() {
  const outDir = join(process.cwd(), 'src/data/monsters');
  const imgDir = join(process.cwd(), 'public/monsters');
  mkdirSync(outDir, { recursive: true });
  mkdirSync(imgDir, { recursive: true });

  console.log('Fetching index page...');
  const indexHtml = await fetchPage(`${BASE_URL}/bm`);
  const allLocations = collectAllLocations(indexHtml);
  console.log(`Found ${allLocations.length} unique locations`);

  // Scrape every location and collect breadcrumb-based hierarchy
  // Structure: island -> subMap -> area
  const islands = new Map();
  const imageUrls = new Map(); // filename -> url

  for (let i = 0; i < allLocations.length; i++) {
    const loc = allLocations[i];
    console.log(`[${i + 1}/${allLocations.length}] ${loc.name}...`);

    try {
      const html = await fetchPage(`${BASE_URL}${loc.href}`);
      const result = parseLocationPage(html);

      // Collect all monsters for image processing
      const allMonstersInResult = result.multiArea
        ? result.areas.flatMap(a => a.monsters)
        : (result.monsters || []);

      if (allMonstersInResult.length === 0) {
        console.log(`  (no monsters)`);
        await delay(200);
        continue;
      }

      for (const m of allMonstersInResult) {
        if (m.image) {
          const filename = m.image.split('/').pop();
          imageUrls.set(filename, m.image);
          m.image = filename;
        }
      }

      const bc = result.breadcrumb;
      let islandName, subMapName;

      if (bc.length >= 2) {
        islandName = bc[0].name;
        subMapName = bc.length >= 3 ? bc[1].name : bc[1].name;
      } else if (bc.length === 1) {
        islandName = bc[0].name;
        subMapName = bc[0].name;
      } else {
        islandName = loc.name;
        subMapName = loc.name;
      }

      if (!islands.has(islandName)) {
        islands.set(islandName, { name: islandName, subMaps: new Map() });
      }
      const island = islands.get(islandName);

      if (result.multiArea) {
        // Island overview page with named sub-areas
        if (!island.subMaps.has(subMapName)) {
          island.subMaps.set(subMapName, { name: subMapName, areas: new Map(), priority: 0 });
        }
        const subMap = island.subMaps.get(subMapName);
        subMap.priority = 0; // Island self-page gets highest priority

        for (const area of result.areas) {
          const areaKey = `${loc.id}-${area.name}`;
          if (!subMap.areas.has(areaKey)) {
            subMap.areas.set(areaKey, {
              id: loc.id,
              name: area.name,
              crystals: area.crystals,
              encounterCount: area.encounterCount,
              monsters: area.monsters,
            });
          }
        }
        console.log(`  ${islandName} > ${subMapName} (${result.areas.length} sub-areas, ${allMonstersInResult.length} monsters)`);
      } else {
        const areaName = bc.length >= 3 ? bc[bc.length - 1].name : bc.length >= 2 ? bc[1].name : loc.name;

        if (!island.subMaps.has(subMapName)) {
          island.subMaps.set(subMapName, { name: subMapName, areas: new Map(), priority: 1 });
        }
        const subMap = island.subMaps.get(subMapName);

        const areaKey = `${loc.id}-${areaName}`;
        if (!subMap.areas.has(areaKey)) {
          subMap.areas.set(areaKey, {
            id: loc.id,
            name: areaName,
            crystals: result.crystals,
            encounterCount: result.encounterCount,
            monsters: result.monsters,
          });
        }

        console.log(`  ${islandName} > ${subMapName} > ${areaName} (${result.monsters.length} monsters)`);
      }
    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }
    await delay(300);
  }

  // Write JSON files per island
  for (const [islandName, island] of islands) {
    const slug = slugify(islandName);
    const subMaps = [];

    const subMapEntries = [...island.subMaps.values()];
    subMapEntries.sort((a, b) => {
      const aIsIsland = a.name === islandName ? 0 : 1;
      const bIsIsland = b.name === islandName ? 0 : 1;
      if (aIsIsland !== bIsIsland) return aIsIsland - bIsIsland;
      return (a.priority || 1) - (b.priority || 1);
    });

    for (const subMap of subMapEntries) {
      const areas = [];
      for (const [, area] of subMap.areas) {
        if (!area.name || !area.name.trim()) {
          area.name = islandName;
        }
        areas.push(area);
      }
      areas.sort((a, b) => {
        const aIsIsland = a.name === islandName ? 0 : 1;
        const bIsIsland = b.name === islandName ? 0 : 1;
        return aIsIsland - bIsIsland;
      });
      if (areas.length > 0) {
        subMaps.push({ name: subMap.name, areas });
      }
    }

    if (subMaps.length === 0) continue;

    const data = { id: slug, name: islandName, subMaps };
    const filePath = join(outDir, `${slug}.json`);
    writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Wrote ${slug}.json (${subMaps.length} sub-maps)`);
  }

  // Write index
  const indexData = [...islands.entries()].map(([name, island]) => ({
    id: slugify(name),
    name,
    subMapCount: island.subMaps.size,
  }));
  writeFileSync(join(outDir, 'index.json'), JSON.stringify(indexData, null, 2));

  // Download images
  console.log(`\nDownloading ${imageUrls.size} images...`);
  let downloaded = 0, skipped = 0;
  const entries = [...imageUrls.entries()];
  for (let i = 0; i < entries.length; i += 10) {
    const batch = entries.slice(i, i + 10);
    await Promise.all(batch.map(async ([filename, url]) => {
      const filepath = join(imgDir, filename);
      if (existsSync(filepath)) { skipped++; return; }
      const ok = await downloadImage(url, filepath);
      if (ok) downloaded++;
    }));
    if ((i + 10) % 100 === 0) console.log(`  Progress: ${Math.min(i + 10, entries.length)}/${entries.length}`);
  }
  console.log(`Done! Downloaded: ${downloaded}, Skipped: ${skipped}`);
}

main().catch(console.error);
