# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.js >> Autenticación — Cerrar sesión >> Después de cerrar sesión no puede acceder a /app
- Location: playwright\tests\auth.spec.js:139:3

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
  1   | // playwright/tests/auth.spec.js
  2   | // ══════════════════════════════════════════════════════════════
  3   | // Mismos escenarios que cypress/e2e/auth.cy.js
  4   | // Propósito: comparativa real de sintaxis, velocidad y DX
  5   | // ══════════════════════════════════════════════════════════════
  6   | 
  7   | import { test, expect } from '@playwright/test'
  8   | 
  9   | const TEST_EMAIL    = process.env.TEST_EMAIL    || 'test@taskflow.com'
  10  | const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Test1234!'
  11  | 
  12  | // Helper equivalente al cy.loginUI() custom command de Cypress
  13  | async function loginUI(page) {
  14  |   await page.goto('/login')
  15  |   await page.locator('[data-cy=email-input]').fill(TEST_EMAIL)
  16  |   await page.locator('[data-cy=password-input]').fill(TEST_PASSWORD)
  17  |   await page.locator('[data-cy=submit-btn]').click()
> 18  |   await expect(page).toHaveURL(/\/app/)
      |                      ^ Error: expect(page).toHaveURL(expected) failed
  19  | }
  20  | 
  21  | // ─────────────────────────────────────────────
  22  | // RUTAS PROTEGIDAS
  23  | // ─────────────────────────────────────────────
  24  | test.describe('Autenticación — Rutas protegidas', () => {
  25  | 
  26  |   test('Redirige a /login si no hay sesión y se accede a /app', async ({ page }) => {
  27  |     await page.goto('/app')
  28  |     await expect(page).toHaveURL(/\/login/)
  29  |   })
  30  | 
  31  |   test('Redirige a /app si ya hay sesión y se accede a /login', async ({ page }) => {
  32  |     await loginUI(page)
  33  |     await page.goto('/login')
  34  |     await expect(page).toHaveURL(/\/app/)
  35  |   })
  36  | 
  37  | })
  38  | 
  39  | // ─────────────────────────────────────────────
  40  | // PÁGINA DE LOGIN
  41  | // ─────────────────────────────────────────────
  42  | test.describe('Autenticación — Página de Login', () => {
  43  | 
  44  |   test.beforeEach(async ({ page }) => {
  45  |     await page.goto('/login')
  46  |   })
  47  | 
  48  |   test('Muestra el formulario de login', async ({ page }) => {
  49  |     await expect(page.locator('[data-cy=login-form]')).toBeVisible()
  50  |     await expect(page.locator('[data-cy=email-input]')).toBeVisible()
  51  |     await expect(page.locator('[data-cy=password-input]')).toBeVisible()
  52  |     await expect(page.locator('[data-cy=submit-btn]')).toBeVisible()
  53  |   })
  54  | 
  55  |   test('Muestra error con correo vacío', async ({ page }) => {
  56  |     await page.locator('[data-cy=submit-btn]').click()
  57  |     await expect(page.locator('[data-cy=auth-error]')).toBeVisible()
  58  |   })
  59  | 
  60  |   test('Muestra error con contraseña vacía', async ({ page }) => {
  61  |     await page.locator('[data-cy=email-input]').fill('alguien@correo.com')
  62  |     await page.locator('[data-cy=submit-btn]').click()
  63  |     await expect(page.locator('[data-cy=auth-error]')).toBeVisible()
  64  |   })
  65  | 
  66  |   test('Muestra error con credenciales incorrectas', async ({ page }) => {
  67  |     await page.locator('[data-cy=email-input]').fill('noexiste@correo.com')
  68  |     await page.locator('[data-cy=password-input]').fill('claveincorrecta')
  69  |     await page.locator('[data-cy=submit-btn]').click()
  70  |     await expect(page.locator('[data-cy=auth-error]')).toBeVisible()
  71  |     await expect(page.locator('[data-cy=auth-error]')).toContainText('incorrectos')
  72  |   })
  73  | 
  74  |   test('Inicia sesión con credenciales correctas y redirige a /app', async ({ page }) => {
  75  |     await page.locator('[data-cy=email-input]').fill(TEST_EMAIL)
  76  |     await page.locator('[data-cy=password-input]').fill(TEST_PASSWORD)
  77  |     await page.locator('[data-cy=submit-btn]').click()
  78  |     await expect(page).toHaveURL(/\/app/)
  79  |     await expect(page.locator('[data-cy=user-email]')).toContainText(TEST_EMAIL)
  80  |   })
  81  | 
  82  |   test('Tiene un enlace a la página de registro', async ({ page }) => {
  83  |     await page.locator('[data-cy=go-register]').click()
  84  |     await expect(page).toHaveURL(/\/register/)
  85  |   })
  86  | 
  87  | })
  88  | 
  89  | // ─────────────────────────────────────────────
  90  | // PÁGINA DE REGISTRO
  91  | // ─────────────────────────────────────────────
  92  | test.describe('Autenticación — Página de Registro', () => {
  93  | 
  94  |   test.beforeEach(async ({ page }) => {
  95  |     await page.goto('/register')
  96  |   })
  97  | 
  98  |   test('Muestra el formulario de registro', async ({ page }) => {
  99  |     await expect(page.locator('[data-cy=register-form]')).toBeVisible()
  100 |     await expect(page.locator('[data-cy=email-input]')).toBeVisible()
  101 |     await expect(page.locator('[data-cy=password-input]')).toBeVisible()
  102 |     await expect(page.locator('[data-cy=confirm-input]')).toBeVisible()
  103 |   })
  104 | 
  105 |   test('Muestra error si las contraseñas no coinciden', async ({ page }) => {
  106 |     await page.locator('[data-cy=email-input]').fill('nuevo@correo.com')
  107 |     await page.locator('[data-cy=password-input]').fill('Clave1234')
  108 |     await page.locator('[data-cy=confirm-input]').fill('ClaveDistinta')
  109 |     await page.locator('[data-cy=submit-btn]').click()
  110 |     await expect(page.locator('[data-cy=auth-error]')).toContainText('coinciden')
  111 |   })
  112 | 
  113 |   test('Muestra error si la contraseña es muy corta', async ({ page }) => {
  114 |     await page.locator('[data-cy=email-input]').fill('nuevo@correo.com')
  115 |     await page.locator('[data-cy=password-input]').fill('123')
  116 |     await page.locator('[data-cy=confirm-input]').fill('123')
  117 |     await page.locator('[data-cy=submit-btn]').click()
  118 |     await expect(page.locator('[data-cy=auth-error]')).toContainText('6 caracteres')
```