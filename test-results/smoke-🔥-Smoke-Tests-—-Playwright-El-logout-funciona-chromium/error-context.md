# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.js >> 🔥 Smoke Tests — Playwright >> El logout funciona
- Location: playwright\tests\smoke.spec.js:45:3

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/app/
Received string:  "http://localhost:5173/login"
Timeout: 8000ms

Call log:
  - Expect "toHaveURL" with timeout 8000ms
    19 × unexpected value "http://localhost:5173/login"

```

```yaml
- text: TaskFlow
- heading "Bienvenido de vuelta" [level=1]
- paragraph: Inicia sesión para ver tus tareas.
- paragraph: Correo o contraseña incorrectos.
- text: Correo electrónico
- textbox "Correo electrónico":
  - /placeholder: tu@correo.com
  - text: test@taskflow.com
- text: Contraseña
- textbox "Contraseña":
  - /placeholder: ••••••••
  - text: Test1234!
- button "Iniciar sesión"
- paragraph:
  - text: ¿No tienes cuenta?
  - link "Regístrate gratis":
    - /url: /register
```

# Test source

```ts
  1  | // playwright/tests/smoke.spec.js
  2  | // ══════════════════════════════════════════════════════════════
  3  | // Mismos escenarios que cypress/e2e/smoke.cy.js
  4  | // ══════════════════════════════════════════════════════════════
  5  | 
  6  | import { test, expect } from '@playwright/test'
  7  | 
  8  | const TEST_EMAIL    = process.env.TEST_EMAIL    || 'test@taskflow.com'
  9  | const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Test1234!'
  10 | 
  11 | test.describe('🔥 Smoke Tests — Playwright', () => {
  12 | 
  13 |   test('La app carga correctamente', async ({ page }) => {
  14 |     await page.goto('/')
  15 |     await expect(page.locator('body')).toBeVisible()
  16 |     await expect(page.locator('#root')).not.toBeEmpty()
  17 |   })
  18 | 
  19 |   test('La página de login es accesible', async ({ page }) => {
  20 |     await page.goto('/login')
  21 |     await expect(page.locator('[data-cy=login-form]')).toBeVisible()
  22 |     await expect(page.locator('[data-cy=email-input]')).toBeVisible()
  23 |     await expect(page.locator('[data-cy=submit-btn]')).toBeVisible()
  24 |   })
  25 | 
  26 |   test('La página de registro es accesible', async ({ page }) => {
  27 |     await page.goto('/register')
  28 |     await expect(page.locator('[data-cy=register-form]')).toBeVisible()
  29 |   })
  30 | 
  31 |   test('Las rutas protegidas redirigen a login', async ({ page }) => {
  32 |     await page.goto('/app')
  33 |     await expect(page).toHaveURL(/\/login/)
  34 |   })
  35 | 
  36 |   test('El login funciona con usuario de prueba', async ({ page }) => {
  37 |     await page.goto('/login')
  38 |     await page.locator('[data-cy=email-input]').fill(TEST_EMAIL)
  39 |     await page.locator('[data-cy=password-input]').fill(TEST_PASSWORD)
  40 |     await page.locator('[data-cy=submit-btn]').click()
  41 |     await expect(page).toHaveURL(/\/app/)
  42 |     await expect(page.locator('[data-cy=todo-list]')).toBeVisible()
  43 |   })
  44 | 
  45 |   test('El logout funciona', async ({ page }) => {
  46 |     await page.goto('/login')
  47 |     await page.locator('[data-cy=email-input]').fill(TEST_EMAIL)
  48 |     await page.locator('[data-cy=password-input]').fill(TEST_PASSWORD)
  49 |     await page.locator('[data-cy=submit-btn]').click()
> 50 |     await expect(page).toHaveURL(/\/app/)
     |                        ^ Error: expect(page).toHaveURL(expected) failed
  51 |     await page.locator('[data-cy=logout-btn]').click()
  52 |     await expect(page).toHaveURL(/\/login/)
  53 |   })
  54 | 
  55 | })
  56 | 
```