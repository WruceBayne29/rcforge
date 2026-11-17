// Generates the README screenshots and the hero GIF with Playwright.
// Usage: node scripts/screenshots.mjs [url]   (default: http://localhost:5184/)
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import gifenc from 'gifenc';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const url = process.argv[2] ?? 'http://localhost:5184/';
const out = 'docs/screenshots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();

async function open(viewport = { width: 1400, height: 900 }, scale = 2) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: scale,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('.sheet');
  await page.evaluate(() => document.fonts.ready);
  return page;
}
const example = async (page, id) => {
  await page.selectOption('.actions select', id);
  await page.waitForTimeout(150);
};
const shot = async (page, name, options = {}) => {
  await page.mouse.move(700, 5);
  await page.waitForTimeout(120);
  await page.screenshot({ path: join(out, name), ...options });
  console.log(`wrote ${out}/${name}`);
};

for (const [id, name] of [
  ['beam-simple', 'beam.png'],
  ['column-biaxial', 'column.png'],
  ['slab-two-way', 'slab.png'],
  ['footing-rect', 'footing.png'],
]) {
  const page = await open();
  await example(page, id);
  await shot(page, name);
  await page.context().close();
}

// The whole sheet, top to bottom.
{
  const page = await open({ width: 1400, height: 900 });
  await example(page, 'beam-doubly');
  await page.locator('.sheet').screenshot({ path: join(out, 'sheet-full.png') });
  console.log(`wrote ${out}/sheet-full.png`);
  await page.context().close();
}

// Phone layout.
{
  const page = await open({ width: 390, height: 820 }, 3);
  await example(page, 'column-circular');
  await page.locator('.desk').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.querySelector('.sheet')?.scrollIntoView());
  await shot(page, 'mobile.png');
  await page.context().close();
}

// First page of the PDF (rendered with macOS `sips` where available).
{
  const page = await open();
  await example(page, 'beam-tee');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.locator('.actions button', { hasText: 'Download PDF' }).click(),
  ]);
  const pdf = join(mkdtempSync(join(tmpdir(), 'rcforge-pdf-')), 'sheet.pdf');
  await download.saveAs(pdf);
  try {
    execFileSync(
      'sips',
      ['-s', 'format', 'png', '--resampleHeight', '1700', pdf, '--out', join(out, 'pdf.png')],
      { stdio: 'ignore' },
    );
    console.log(`wrote ${out}/pdf.png`);
  } catch {
    console.log('skipped pdf.png (sips not available)');
  }
  await page.context().close();
}

// Hero GIF: deepen a beam and watch the sheet change, then visit each element.
{
  const page = await open({ width: 1040, height: 640 }, 1);
  await example(page, 'beam-simple');
  const frames = [];
  const grab = async (hold = 1) =>
    frames.push({ png: PNG.sync.read(await page.screenshot()), delay: 120 * hold });
  await grab(8);
  const depth = page.locator('.inputs input[aria-label="Overall depth"]');
  for (const value of [450, 400, 380, 450, 550, 650]) {
    await depth.fill(String(value));
    await depth.press('Enter');
    await page.waitForTimeout(70);
    await grab(5);
  }
  await page.locator('.choice label', { hasText: 'T-beam' }).click();
  await grab(8);
  for (const label of ['Column', 'Slab', 'Footing']) {
    await page.locator('.elements button', { hasText: label }).click();
    await page.waitForTimeout(100);
    await grab(11);
  }
  const { width, height } = frames[0].png;
  const gif = GIFEncoder();
  for (const { png, delay } of frames) {
    const palette = quantize(png.data, 64);
    gif.writeFrame(applyPalette(png.data, palette), width, height, { palette, delay });
  }
  gif.finish();
  writeFileSync(join(out, 'hero.gif'), gif.bytes());
  console.log(
    `wrote ${out}/hero.gif (${frames.length} frames, ${(gif.bytes().length / 1e6).toFixed(1)} MB)`,
  );
  await page.context().close();
}

await browser.close();
