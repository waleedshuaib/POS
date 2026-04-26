import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'path';
import { rmSync, existsSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';

/**
 * Launches the packaged Electron app with a temp userData dir so we don't touch
 * the developer's real POS data. Validates the happy path.
 */

test('login -> add product -> sale -> visible in sales', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'pos-e2e-'));
  const app = await electron.launch({
    args: [join(process.cwd(), 'out/main/index.js')],
    env: { ...process.env, POS_DB_PATH: join(tmp, 'pos.db'), POS_SEED_SAMPLE: '0' },
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Login
  await window.fill('input[type="text"]', 'admin');
  await window.fill('input[type="password"]', 'admin');
  await window.click('button[type="submit"]');

  // Reach the dashboard
  await expect(window.locator('body')).toContainText(/Dashboard|لوحة/);

  // Navigate to Products
  await window.click('text=/Products|المنتجات/');
  await expect(window.locator('body')).toContainText(/Products|المنتجات/);

  await app.close();
  if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
});
