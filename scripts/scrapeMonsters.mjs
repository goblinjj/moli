import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync } from 'fs';
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

function parseIndex(html) {
  const $ = cheerio.load(html);
  const regions = [];
  const seen = new Set();

  $('#menuroot > li.sub').each((_, regionLi) => {
    const regionLink = $(regionLi).find('> a');
    const regionName = regionLink.text().trim();
    const regionHref = regionLink.attr('href') || '';
    const regionId = regionHref.replace('/bm/', '').split('-')[0];

    if (!regionName || !regionId) return;

    const locations = [];

    function collectLinks(parentEl) {
      $(parentEl).find('> ul > li').each((_, li) => {
        const link = $(li).find('> a');
        const href = link.attr('href') || '';
        const name = link.text().trim();
        if (href.startsWith('/bm/') && name) {
          const id = href.replace('/bm/', '').split('-')[0];
          const key = `${id}-${name}`;
          if (!seen.has(key)) {
            seen.add(key);
            locations.push({ id, name, href });
          }
        }
        if ($(li).hasClass('sub')) {
          collectLinks(li);
        }
      });
    }

    collectLinks(regionLi);

    const regionSelfKey = `${regionId}-${regionName}`;
    if (!seen.has(regionSelfKey)) {
      seen.add(regionSelfKey);
      locations.push({ id: regionId, name: regionName, href: regionHref });
    }

    if (locations.length > 0) {
      regions.push({
        id: regionId,
        name: regionName,
        locations,
      });
    }
  });

  return regions;
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

function parseLocationPage(html) {
  const $ = cheerio.load(html);
  const monsters = [];

  $('div[style*="background:#FFFFDD"]').each((_, section) => {
    const $section = $(section);

    const bossHeader = $section.find('div[style*="position: absolute"][style*="margin-top: -34px"]');
    const isBossSection = bossHeader.length > 0;

    const infoBox = $section.find('div[style*="background-color: #FFE"]');
    let encounterCount = '';
    let crystals = [];

    if (infoBox.length) {
      const infoText = infoBox.text();
      const countMatch = infoText.match(/出現數量:\s*(\d+-\d+)隻/);
      if (countMatch) encounterCount = countMatch[1];

      const crystalMatch = infoText.match(/建議水晶:\s*(.*)/);
      if (crystalMatch) {
        crystals = crystalMatch[1].trim().split(/\s+/).filter(c => c && c.includes('('));
      }
    }

    const monsterDivs = $section.find('.beastCell');

    monsterDivs.each((_, cellDiv) => {
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

      const infoHtml = $info.html() || '';
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

      const isBoss = isBossSection && $cell.hasClass('expand');

      const imageDiv = $cell.find('.imageparty, .beastImg');
      let image = '';
      if (imageDiv.length) {
        const bgStyle = imageDiv.attr('style') || '';
        const imgMatch = bgStyle.match(/url\(([^)]+)\)/);
        if (imgMatch) {
          image = imgMatch[1].replace(/^\/\//, 'https://').replace(/['"]/g, '');
        }
      }

      monsters.push({
        name,
        levelMin,
        levelMax,
        ...elements,
        type,
        typeDetail,
        cardGrade,
        sealable,
        encounterCount,
        crystals: isBoss ? [] : crystals,
        isBoss,
        image,
      });
    });
  });

  return monsters;
}

function slugify(name) {
  const map = {
    '芙蕾雅島': 'fureya',
    '索奇亞島': 'sochia',
    '莎蓮娜島': 'shalena',
    '米內葛爾島': 'minegl',
    '庫魯克斯島': 'kruks',
    '德威特島': 'dewitt',
    '傑諾姆島': 'genom',
    '弗利德島': 'fried',
    '樂園之卵': 'paradise',
    '辛梅爾': 'simmel',
    '諾斯菲拉特': 'nospherat',
    '哈那可半島': 'hanako',
    '逆星': 'gyaku',
    '日耀之域': 'nichiyo',
    '水曜之域': 'suiyo',
  };
  return map[name] || name;
}

async function main() {
  const outDir = join(process.cwd(), 'src/data/monsters');
  mkdirSync(outDir, { recursive: true });

  console.log('Fetching index page...');
  const indexHtml = await fetchPage(`${BASE_URL}/bm`);
  const regions = parseIndex(indexHtml);
  console.log(`Found ${regions.length} regions`);

  for (const region of regions) {
    const slug = slugify(region.name);
    console.log(`\n=== ${region.name} (${slug}) - ${region.locations.length} locations ===`);

    const regionData = {
      id: slug,
      name: region.name,
      locations: [],
    };

    for (const loc of region.locations) {
      console.log(`  Fetching ${loc.name}...`);
      try {
        const html = await fetchPage(`${BASE_URL}${loc.href}`);
        const monsters = parseLocationPage(html);
        console.log(`    Found ${monsters.length} monsters`);

        if (monsters.length > 0) {
          regionData.locations.push({
            id: loc.id,
            name: loc.name,
            monsters,
          });
        }
      } catch (err) {
        console.error(`    Error: ${err.message}`);
      }
      await delay(300);
    }

    if (regionData.locations.length > 0) {
      const filePath = join(outDir, `${slug}.json`);
      writeFileSync(filePath, JSON.stringify(regionData, null, 2));
      console.log(`  Wrote ${filePath}`);
    }
  }

  const indexData = regions
    .map(r => ({
      id: slugify(r.name),
      name: r.name,
      locationCount: r.locations.length,
    }))
    .filter(r => r.locationCount > 0);

  writeFileSync(join(outDir, 'index.json'), JSON.stringify(indexData, null, 2));
  console.log('\nDone! Wrote index.json');
}

main().catch(console.error);
