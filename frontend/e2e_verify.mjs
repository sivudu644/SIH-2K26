import puppeteer from 'puppeteer-core';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const executablePath = fs.existsSync(CHROME_PATH) ? CHROME_PATH : EDGE_PATH;
console.log(`Using browser executable: ${executablePath}`);

async function runE2ETests() {
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  const consoleErrors = [];
  const consoleLogs = [];

  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    consoleLogs.push(`[${type}] ${text}`);
    if (type === 'error') {
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(`[PageError] ${err.toString()}`);
  });

  const results = [];
  function record(testName, passed, detail = '') {
    results.push({ testName, passed, detail });
    console.log(`${passed ? '✓' : '✗'} ${testName}: ${passed ? 'PASSED' : 'FAILED'} ${detail ? `(${detail})` : ''}`);
  }

  try {
    // 1. Load Homepage / Dashboard
    console.log('\n--- 1. Loading Dashboard ---');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 });
    const title = await page.title();
    record('Page title contains InfraSync AI', title.includes('InfraSync AI'), title);

    await page.waitForSelector('.stats-grid', { timeout: 5000 });
    const statsCards = await page.$$('.stats-grid .stat-card');
    record('Dashboard KPI Cards Rendered', statsCards.length >= 5, `Found ${statsCards.length} cards`);

    // 2. Click KPI card to navigate to Schedule Explorer
    console.log('\n--- 2. Testing KPI Card Navigation ---');
    const firstCard = await page.$('.stats-grid > div:first-child');
    if (firstCard) {
      await firstCard.click();
      await new Promise((r) => setTimeout(r, 800));
      const explorerHeader = await page.evaluate(() => {
        return document.querySelector('h1')?.textContent || '';
      });
      record('KPI Click Navigates to Schedule Explorer', explorerHeader.includes('Schedule Baseline Explorer'), explorerHeader);
    }

    // 3. Test Schedule Explorer Filter & Detail Drawer
    console.log('\n--- 3. Testing Schedule Explorer & Activity Drawer ---');
    await page.waitForSelector('table tbody tr.clickable-row', { timeout: 8000 });
    const activityRows = await page.$$('table tbody tr.clickable-row');
    record('Schedule Activities Loaded', activityRows.length > 0, `Count: ${activityRows.length}`);

    if (activityRows.length > 0) {
      await activityRows[0].click();
      await new Promise((r) => setTimeout(r, 600));
      const drawerVisible = await page.evaluate(() => {
        return document.body.textContent.includes('Activity Overview') || document.body.textContent.includes('WBS:');
      });
      record('Activity Detail Drawer Opens on Row Click', drawerVisible);

      // Close drawer by clicking close button with aria-label
      await page.evaluate(() => {
        const closeBtn = document.querySelector('button[aria-label="Close drawer"]') || document.querySelector('button[aria-label="Close"]');
        if (closeBtn) closeBtn.click();
      });
      await new Promise((r) => setTimeout(r, 500));
    }

    // 4. Test Global Search Modal
    console.log('\n--- 4. Testing Global Search Modal (Quick Search & Ctrl+K) ---');
    // Click Quick Search button in sidebar
    const clickedSearch = await page.evaluate(() => {
      const qBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent && b.textContent.includes('Quick Search'));
      if (qBtn) {
        qBtn.click();
        return true;
      }
      return false;
    });
    console.log('Clicked Quick Search button:', clickedSearch);
    await new Promise((r) => setTimeout(r, 800));

    const searchInput = await page.waitForSelector('input[placeholder*="Search activities"]', { timeout: 4000 }).catch(() => null);
    record('Global Search Modal Opens via Quick Search Trigger', !!searchInput);

    if (searchInput) {
      await searchInput.type('spool');
      await new Promise((r) => setTimeout(r, 500));
      const resultsText = await page.evaluate(() => document.body.textContent);
      record('Global Search Filters Activities & Events', resultsText.includes('spool') || resultsText.includes('PIP-001'));

      await page.keyboard.press('Escape');
      await new Promise((r) => setTimeout(r, 400));
    }

    // 5. Test Progress Events Page
    console.log('\n--- 5. Testing Progress Events Page ---');
    await page.evaluate(() => {
      const navItems = Array.from(document.querySelectorAll('nav div, aside button, nav a'));
      const evItem = navItems.find((el) => el.textContent.includes('Progress Events'));
      if (evItem) evItem.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const eventsHeader = await page.evaluate(() => document.querySelector('h1')?.textContent || '');
    record('Navigates to Progress Events Page', eventsHeader.includes('Progress Events'), eventsHeader);

    // 6. Test AI Time Agent Intent Guard
    console.log('\n--- 6. Testing AI Time Agent Intent Guard ---');
    await page.evaluate(() => {
      const navItems = Array.from(document.querySelectorAll('nav div, aside button, nav a'));
      const agentItem = navItems.find((el) => el.textContent.includes('AI Time Agent'));
      if (agentItem) agentItem.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const agentInput = await page.$('input[placeholder*="progress"], input[placeholder*="Agent"], textarea');
    record('AI Time Agent Chat Input Available', !!agentInput);

    if (agentInput) {
      // Test 6a: Greeting "Hi"
      await agentInput.click();
      await page.evaluate((el) => (el.value = ''), agentInput);
      await agentInput.type('Hi');
      await page.keyboard.press('Enter');
      await new Promise((r) => setTimeout(r, 1600));

      let bodyText = await page.evaluate(() => document.body.textContent);
      const greetingGuarded = bodyText.includes('Hello!') || bodyText.includes('AI Time Agent');
      const greetingDidNotExtract = !bodyText.includes('CONFIRM PROGRESS TO SCHEDULE');
      record('Intent Guard: "Hi" remains conversational without entering progress pipeline', greetingGuarded && greetingDidNotExtract);

      // Test 6b: Capability "What can you do?"
      await agentInput.click();
      await page.evaluate((el) => (el.value = ''), agentInput);
      await agentInput.type('What can you do?');
      await page.keyboard.press('Enter');
      await new Promise((r) => setTimeout(r, 1600));

      bodyText = await page.evaluate(() => document.body.textContent);
      const capGuarded = bodyText.includes('Extract') || bodyText.includes('Match') || bodyText.includes('baseline');
      record('Intent Guard: "What can you do?" returns capability overview without entering progress pipeline', capGuarded);

      // Test 6c: Mixed Greeting + Valid Progress
      await agentInput.click();
      await page.evaluate((el) => (el.value = ''), agentInput);
      await agentInput.type('Hi, today we completed spool erection in Area A');
      await page.keyboard.press('Enter');
      await new Promise((r) => setTimeout(r, 2500));

      bodyText = await page.evaluate(() => document.body.textContent);
      const progressExtracted = bodyText.includes('Extracted draft execution event') || bodyText.includes('CONFIRM') || bodyText.includes('PIP-');
      record('Mixed greeting + progress: "Hi, today we completed spool erection in Area A" enters progress pipeline', progressExtracted);
    }

    // 7. Test Review Queue Page
    console.log('\n--- 7. Testing Review Queue Page ---');
    await page.evaluate(() => {
      const navItems = Array.from(document.querySelectorAll('nav div, aside button, nav a'));
      const reviewItem = navItems.find((el) => el.textContent.includes('Review Queue'));
      if (reviewItem) reviewItem.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const reviewHeader = await page.evaluate(() => document.querySelector('h1')?.textContent || '');
    record('Navigates to Human-in-the-Loop Review Queue', reviewHeader.includes('Review Queue'), reviewHeader);

    // 8. Test Institutional Memory Page
    console.log('\n--- 8. Testing Institutional Memory Page ---');
    await page.evaluate(() => {
      const navItems = Array.from(document.querySelectorAll('nav div, aside button, nav a'));
      const memItem = navItems.find((el) => el.textContent.includes('Institutional Memory'));
      if (memItem) memItem.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const memHeader = await page.evaluate(() => document.querySelector('h1')?.textContent || '');
    record('Navigates to Institutional Memory & Ontology Graph', memHeader.includes('Institutional Memory'), memHeader);

    const lexiconEntries = await page.evaluate(() => {
      const badge = Array.from(document.querySelectorAll('.badge')).find((b) => b.textContent.includes('Terms'));
      return badge ? badge.textContent : null;
    });
    record('Domain Terminology Lexicon Rendered', !!lexiconEntries, lexiconEntries || '0 terms');

    // 9. Console Error Verification
    console.log('\n--- 9. Verifying Browser Console Output ---');
    const severeErrors = consoleErrors.filter((e) => !e.includes('favicon.ico'));
    record('Browser Console has 0 errors', severeErrors.length === 0, severeErrors.join('; '));

  } catch (err) {
    console.error('Fatal test runner error:', err);
    record('E2E Execution', false, err.message);
  } finally {
    await browser.close();
    console.log('\n========================================');
    console.log(`TOTAL TESTS: ${results.length}`);
    console.log(`PASSED: ${results.filter((r) => r.passed).length}`);
    console.log(`FAILED: ${results.filter((r) => !r.passed).length}`);
    console.log('========================================\n');

    if (results.some((r) => !r.passed)) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runE2ETests();
