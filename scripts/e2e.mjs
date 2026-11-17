// End-to-end check: opens the app in headless Chromium and uses every feature.
// Usage: node scripts/e2e.mjs [url]   (default: the live GitHub Pages site)
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const url = process.argv[2] ?? process.env.RCFORGE_URL ?? 'https://wrucebayne29.github.io/rcforge/';
const tmp = mkdtempSync(join(tmpdir(), 'rcforge-e2e-'));
const results = [];
const errors = [];

function check(name, condition, detail = '') {
  results.push({ name, ok: !!condition });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const stamp = () => page.locator('.stamp').innerText();
const tab = (label) => page.locator('.elements button', { hasText: label }).click();
const field = (name) => page.locator(`.inputs input[aria-label="${name}"]`);
const setField = async (name, value) => {
  const input = field(name);
  await input.fill(String(value));
  await input.press('Enter');
  await page.waitForTimeout(60);
};
const output = (title) =>
  page
    .locator('.calc tbody tr', { has: page.locator('.work b', { hasText: title }) })
    .first()
    .locator('.out-cell')
    .innerText();

try {
  // ---- 1. First load ----
  await page.goto(url, { waitUntil: 'networkidle' });
  check('page loads with the right title', (await page.title()).includes('RCForge'));
  await page.waitForSelector('.sheet');
  check(
    'the beam sheet is shown by default',
    (await page.locator('.elements button[aria-selected="true"]').innerText()) === 'Beam',
  );
  check('default beam is safe', (await stamp()) === 'SAFE');
  check('section drawing is drawn', (await page.locator('.figure svg circle').count()) >= 4);
  const steps = await page.locator('.calc:not(.schedule) tbody tr:not(.heading)').count();
  check('working is shown step by step', steps >= 15, `${steps} steps`);
  check(
    'steps carry clause references',
    (await page.locator('.ref-cell', { hasText: 'Cl. 38.1' }).count()) > 0,
  );
  check(
    'title block is present',
    (await page.locator('.title-block').innerText()).includes('IS 456 : 2000'),
  );
  check('bar schedule is shown', (await page.locator('.calc.schedule tbody tr').count()) >= 3);

  // ---- 2. Beam inputs drive the sheet ----
  const before = await output('Tension reinforcement');
  await setField('Overall depth', 600);
  const after = await output('Tension reinforcement');
  check('changing the depth changes the steel', before !== after, `${before} -> ${after}`);
  await setField('Width', 50);
  check(
    'impossible inputs are explained',
    (await page.locator('.problems').innerText()).includes('Width b must be at least 150'),
  );
  await setField('Width', 300);
  check('the sheet returns when the input is fixed', (await page.locator('.sheet').count()) === 1);

  await page.locator('.choice label', { hasText: 'T-beam' }).click();
  check('T-beam shows flange inputs', (await field('Flange width').count()) === 1);
  check(
    'T-beam applies the flange factor',
    (await page.locator('.ref-cell', { hasText: 'Fig. 6' }).count()) === 1,
  );
  await page.locator('.choice label', { hasText: 'Rectangular' }).click();

  await page.locator('.choice label', { hasText: 'Mu and Vu known' }).click();
  await setField('Design moment', 480);
  check(
    'a heavy moment gives a doubly reinforced section',
    (await output('Type of section')) === 'Doubly reinforced',
  );
  await setField('Design shear', 900);
  check('excessive shear is rejected', (await stamp()) === 'REVISE');
  await page.locator('.choice label', { hasText: 'Uniform load' }).click();
  await setField('Overall depth', 500);
  check('uniform loading restores a safe design', (await stamp()) === 'SAFE');

  // ---- 3. Column ----
  await tab('Column');
  check(
    'column sheet shows the interaction chart',
    (await page.locator('.figure svg polyline').count()) === 2,
  );
  check('default column is safe', (await stamp()) === 'SAFE');
  check(
    'biaxial check is worked',
    (await page.locator('.work b', { hasText: 'Biaxial bending check' }).count()) === 1,
  );
  await setField('Axial load', 9000);
  check('an overloaded column must be revised', (await stamp()) === 'REVISE');
  await setField('Axial load', 1200);
  await setField('Unsupported length', 6);
  check(
    'a tall column is treated as slender',
    (await output('Slenderness ratios')).includes('Slender'),
  );
  await setField('Unsupported length', 3.2);
  await page.locator('.choice label', { hasText: 'Circular' }).click();
  check('circular columns are drawn', (await page.locator('.figure svg circle').count()) >= 8);
  await page.locator('.choice label', { hasText: 'Rectangular' }).click();

  // ---- 4. Slab ----
  await tab('Slab');
  check(
    'two-way slab uses Table 26',
    (await page.locator('.ref-cell', { hasText: 'Table 26' }).count()) === 1,
  );
  check('default slab is safe', (await stamp()) === 'SAFE');
  await page.locator('.choice label', { hasText: 'One-way' }).click();
  check(
    'one-way slab has distribution steel',
    (await page.locator('.work b', { hasText: 'Distribution steel' }).count()) === 1,
  );
  await setField('Short span', 7);
  check('a thin long slab fails deflection', (await stamp()) === 'REVISE');
  await setField('Short span', 4);
  await page.locator('.choice label', { hasText: 'Two-way' }).click();

  // ---- 5. Footing ----
  await tab('Footing');
  check(
    'footing plan and section are drawn',
    (await page.locator('.figure svg line').count()) > 20,
  );
  check('default footing is safe', (await stamp()) === 'SAFE');
  check(
    'punching shear is checked',
    (await page.locator('.work b', { hasText: 'Punching shear' }).count()) === 1,
  );
  await setField('Depth', 250);
  check('a shallow footing fails in shear', (await stamp()) === 'REVISE');
  await setField('Depth', 0);

  // ---- 6. Worked examples ----
  const examples = await page
    .locator('.actions select option')
    .evaluateAll((els) => els.map((e) => e.value).filter(Boolean));
  check('there are at least 8 worked examples', examples.length >= 8, `${examples.length}`);
  for (const id of examples) {
    await page.selectOption('.actions select', id);
    await page.waitForTimeout(80);
    check(`example "${id}" gives a workable design`, ['SAFE', 'CHECK'].includes(await stamp()));
  }

  // ---- 7. Save, open, share, PDF ----
  await page.selectOption('.actions select', 'beam-tee');
  await page.locator('.title-block input[aria-label="Prepared by"]').fill('A. Student');
  const [json] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.actions button', { hasText: 'Save' }).click(),
  ]);
  const jsonPath = join(tmp, 'design.json');
  await json.saveAs(jsonPath);
  const saved = JSON.parse(readFileSync(jsonPath, 'utf8'));
  check(
    'save downloads the design as JSON',
    saved.format === 'rcforge-project' &&
      saved.beam.shape === 'tee' &&
      saved.author === 'A. Student',
  );

  await page.selectOption('.actions select', 'footing-square');
  await page.setInputFiles('input[type="file"]', jsonPath);
  await page.waitForTimeout(150);
  check(
    'open restores the saved design',
    (await page.locator('.title-block input[aria-label="Job title"]').inputValue()).includes(
      'T-beam',
    ),
  );
  const bad = join(tmp, 'bad.json');
  writeFileSync(bad, '{"beam": {"b": "wide"}}');
  await page.setInputFiles('input[type="file"]', bad);
  await page.waitForSelector('.toast.error');
  check(
    'a malformed file is refused with a reason',
    (await page.locator('.toast.error').innerText()).includes('must be a number'),
  );

  await page.locator('.actions button', { hasText: 'Share' }).click();
  await page.waitForFunction(() => location.hash.startsWith('#m='));
  const shared = page.url();
  check(
    'share puts the design in the link',
    shared.includes('#m=1.'),
    `${shared.length} characters`,
  );
  check(
    'share copies the link',
    (await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')) === shared,
  );
  const second = await context.newPage();
  second.on('pageerror', (e) => errors.push(String(e)));
  await second.goto(shared, { waitUntil: 'networkidle' });
  await second.waitForSelector('.sheet');
  await second.waitForTimeout(250);
  check(
    'opening the link shows the same design',
    (await second.locator('.title-block input[aria-label="Job title"]').inputValue()).includes(
      'T-beam',
    ),
  );
  await second.close();

  const [pdf] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.locator('.actions button', { hasText: 'Download PDF' }).click(),
  ]);
  const pdfPath = join(tmp, 'sheet.pdf');
  await pdf.saveAs(pdfPath);
  const bytes = readFileSync(pdfPath);
  check(
    'PDF calculation sheet downloads',
    bytes.subarray(0, 5).toString() === '%PDF-' && bytes.length > 15000,
    `${bytes.length} bytes`,
  );
  check(
    'PDF is named after the job',
    pdf.suggestedFilename().endsWith('-beam.pdf'),
    pdf.suggestedFilename(),
  );

  // ---- 8. Guide, keys, layout, persistence ----
  await page.locator('.actions button', { hasText: 'About' }).click();
  check(
    'the About note opens',
    (await page.locator('.note').innerText()).includes('How to read this sheet'),
  );
  await page.locator('.note button', { hasText: 'Show me round' }).click();
  check(
    'the tour starts',
    (await page.locator('.tour-card').innerText()).includes('1 OF 4') ||
      (await page.locator('.tour-card').innerText()).includes('1 of 4'),
  );
  for (let k = 0; k < 3; k++) await page.locator('.tour-card button.solid').click();
  await page.locator('.tour-card button.solid').click();
  check('the tour finishes', (await page.locator('.tour').count()) === 0);

  await page.locator('.desk').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('2');
  check(
    'number keys switch element',
    (await page.locator('.elements button[aria-selected="true"]').innerText()) === 'Column',
  );
  await page.keyboard.press('1');

  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForTimeout(150);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  check('phone layout has no sideways scroll', !overflow);
  check(
    'the sheet is still readable on a phone',
    (await page.locator('.sheet').boundingBox()).width > 300,
  );
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.sheet');
  check(
    'the last design is restored after a reload',
    (await page.locator('.title-block input[aria-label="Job title"]').inputValue()).includes(
      'T-beam',
    ),
  );
} catch (e) {
  check('script ran to completion', false, String(e).slice(0, 300));
}

check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed on ${url}`);
process.exit(failed.length === 0 ? 0 : 1);
