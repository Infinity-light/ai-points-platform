import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /登录/i })).toBeVisible()
    await expect(page.getByPlaceholder(/邮箱/i)).toBeVisible()
    await expect(page.getByPlaceholder(/密码/i)).toBeVisible()
  })

  test('should show register page', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('heading', { name: /注册/i })).toBeVisible()
  })

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})
