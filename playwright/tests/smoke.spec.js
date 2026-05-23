// playwright/tests/smoke.spec.js
// ══════════════════════════════════════════════════════════════
// Mismos escenarios que cypress/e2e/smoke.cy.js
// ══════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'

const TEST_EMAIL    = process.env.TEST_EMAIL    || 'test@taskflow.com'
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Test1234!'

test.describe('🔥 Smoke Tests — Playwright', () => {

  test('La app carga correctamente', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('#root')).not.toBeEmpty()
  })

  test('La página de login es accesible', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('[data-cy=login-form]')).toBeVisible()
    await expect(page.locator('[data-cy=email-input]')).toBeVisible()
    await expect(page.locator('[data-cy=submit-btn]')).toBeVisible()
  })

  test('La página de registro es accesible', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('[data-cy=register-form]')).toBeVisible()
  })

  test('Las rutas protegidas redirigen a login', async ({ page }) => {
    await page.goto('/app')
    await expect(page).toHaveURL(/\/login/)
  })

  test('El login funciona con usuario de prueba', async ({ page }) => {
    await page.goto('/login')
    await page.locator('[data-cy=email-input]').fill(TEST_EMAIL)
    await page.locator('[data-cy=password-input]').fill(TEST_PASSWORD)
    await page.locator('[data-cy=submit-btn]').click()
    await expect(page).toHaveURL(/\/app/)
    await expect(page.locator('[data-cy=todo-list]')).toBeVisible()
  })

  test('El logout funciona', async ({ page }) => {
    await page.goto('/login')
    await page.locator('[data-cy=email-input]').fill(TEST_EMAIL)
    await page.locator('[data-cy=password-input]').fill(TEST_PASSWORD)
    await page.locator('[data-cy=submit-btn]').click()
    await expect(page).toHaveURL(/\/app/)
    await page.locator('[data-cy=logout-btn]').click()
    await expect(page).toHaveURL(/\/login/)
  })

})
