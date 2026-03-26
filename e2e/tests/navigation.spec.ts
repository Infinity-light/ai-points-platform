import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('should show login page at root', async ({ page }) => {
    await page.goto('/')
    // either dashboard or login
    const url = page.url()
    expect(url).toMatch(/\/(login|dashboard)/)
  })
})
