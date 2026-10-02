import { expect, test } from '@playwright/test';
import { jumpProbe } from '../e2e/jump-probe';

const COUNT = 10_000;

test('the packed library works in a fresh Angular app', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  const rows = page.locator('virtual-scroller.list [data-index]');
  await expect(rows.first()).toHaveAttribute('data-index', '0');
  // Let the scroller's measuring passes settle
  await page.waitForTimeout(300);
  expect(await rows.count(), 'only a window of rows is rendered').toBeLessThan(50);

  const down = await page.evaluate(jumpProbe, {
    scrollRoot: null,
    horizontal: false,
    spacing: 0,
    step: 50,
    frames: 120,
    lastId: COUNT - 1,
  });
  expect(down.jumps.slice(0, 3), 'rows moved by exactly the scroll delta').toEqual([]);
  expect(down.gaps.slice(0, 3), 'rows cover the viewport').toEqual([]);
  expect(down.comparedFrames, 'frames with rows to compare').toBeGreaterThan(down.samples * 0.8);
  expect(down.maxId, 'new rows rendered').toBeGreaterThan(100);
  expect(down.maxRendered, 'only a window of rows is rendered').toBeLessThan(50);

  await page.getByRole('button', { name: 'Jump to 5000' }).click();
  await expect(page.locator('[data-index="5000"]')).toBeInViewport();
  await expect(page.getByTestId('range')).toHaveText(/^5000-/);

  await expect(page.locator('[data-legacy="0"]'), 'the deprecated module renders').toBeVisible();
  expect(errors, 'no console errors').toEqual([]);
});
