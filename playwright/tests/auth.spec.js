// playwright/tests/auth.spec.js
// ══════════════════════════════════════════════════════════════
// Mismos escenarios que cypress/e2e/auth.cy.js
// Propósito: comparativa real de sintaxis, velocidad y DX
// ══════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'

const TEST_EMAIL    = process.env.TEST_EMAIL    || 'test@taskflow.com'
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Test1234!'

// Helper equivalente al cy.loginUI() custom command de Cypress
async function loginUI(page) {
  await page.goto('/login')
  await page.locator('[data-cy=email-input]').fill(TEST_EMAIL)
  await page.locator('[data-cy=password-input]').fill(TEST_PASSWORD)
  await page.locator('[data-cy=submit-btn]').click()
  await expect(page).toHaveURL(/\/app/)
}

// ─────────────────────────────────────────────
// RUTAS PROTEGIDAS
// ─────────────────────────────────────────────
test.describe('Autenticación — Rutas protegidas', () => {

  test('Redirige a /login si no hay sesión y se accede a /app', async ({ page }) => {
    await page.goto('/app')
    await expect(page).toHaveURL(/\/login/)
  })

  test('Redirige a /app si ya hay sesión y se accede a /login', async ({ page }) => {
    await loginUI(page)
    await page.goto('/login')
    await expect(page).toHaveURL(/\/app/)
  })

})

// ─────────────────────────────────────────────
// PÁGINA DE LOGIN
// ─────────────────────────────────────────────
test.describe('Autenticación — Página de Login', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('Muestra el formulario de login', async ({ page }) => {
    await expect(page.locator('[data-cy=login-form]')).toBeVisible()
    await expect(page.locator('[data-cy=email-input]')).toBeVisible()
    await expect(page.locator('[data-cy=password-input]')).toBeVisible()
    await expect(page.locator('[data-cy=submit-btn]')).toBeVisible()
  })

  test('Muestra error con correo vacío', async ({ page }) => {
    await page.locator('[data-cy=submit-btn]').click()
    await expect(page.locator('[data-cy=auth-error]')).toBeVisible()
  })

  test('Muestra error con contraseña vacía', async ({ page }) => {
    await page.locator('[data-cy=email-input]').fill('alguien@correo.com')
    await page.locator('[data-cy=submit-btn]').click()
    await expect(page.locator('[data-cy=auth-error]')).toBeVisible()
  })

  test('Muestra error con credenciales incorrectas', async ({ page }) => {
    await page.locator('[data-cy=email-input]').fill('noexiste@correo.com')
    await page.locator('[data-cy=password-input]').fill('claveincorrecta')
    await page.locator('[data-cy=submit-btn]').click()
    await expect(page.locator('[data-cy=auth-error]')).toBeVisible()
    await expect(page.locator('[data-cy=auth-error]')).toContainText('incorrectos')
  })

  test('Inicia sesión con credenciales correctas y redirige a /app', async ({ page }) => {
    await page.locator('[data-cy=email-input]').fill(TEST_EMAIL)
    await page.locator('[data-cy=password-input]').fill(TEST_PASSWORD)
    await page.locator('[data-cy=submit-btn]').click()
    await expect(page).toHaveURL(/\/app/)
    await expect(page.locator('[data-cy=user-email]')).toContainText(TEST_EMAIL)
  })

  test('Tiene un enlace a la página de registro', async ({ page }) => {
    await page.locator('[data-cy=go-register]').click()
    await expect(page).toHaveURL(/\/register/)
  })

})

// ─────────────────────────────────────────────
// PÁGINA DE REGISTRO
// ─────────────────────────────────────────────
test.describe('Autenticación — Página de Registro', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/register')
  })

  test('Muestra el formulario de registro', async ({ page }) => {
    await expect(page.locator('[data-cy=register-form]')).toBeVisible()
    await expect(page.locator('[data-cy=email-input]')).toBeVisible()
    await expect(page.locator('[data-cy=password-input]')).toBeVisible()
    await expect(page.locator('[data-cy=confirm-input]')).toBeVisible()
  })

  test('Muestra error si las contraseñas no coinciden', async ({ page }) => {
    await page.locator('[data-cy=email-input]').fill('nuevo@correo.com')
    await page.locator('[data-cy=password-input]').fill('Clave1234')
    await page.locator('[data-cy=confirm-input]').fill('ClaveDistinta')
    await page.locator('[data-cy=submit-btn]').click()
    await expect(page.locator('[data-cy=auth-error]')).toContainText('coinciden')
  })

  test('Muestra error si la contraseña es muy corta', async ({ page }) => {
    await page.locator('[data-cy=email-input]').fill('nuevo@correo.com')
    await page.locator('[data-cy=password-input]').fill('123')
    await page.locator('[data-cy=confirm-input]').fill('123')
    await page.locator('[data-cy=submit-btn]').click()
    await expect(page.locator('[data-cy=auth-error]')).toContainText('6 caracteres')
  })

  test('Tiene un enlace a la página de login', async ({ page }) => {
    await page.locator('[data-cy=go-login]').click()
    await expect(page).toHaveURL(/\/login/)
  })

})

// ─────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────
test.describe('Autenticación — Cerrar sesión', () => {

  test('Puede cerrar sesión y redirige a /login', async ({ page }) => {
    await loginUI(page)
    await page.locator('[data-cy=logout-btn]').click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('Después de cerrar sesión no puede acceder a /app', async ({ page }) => {
    await loginUI(page)
    await page.locator('[data-cy=logout-btn]').click()
    await page.goto('/app')
    await expect(page).toHaveURL(/\/login/)
  })

})
