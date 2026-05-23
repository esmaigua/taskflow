# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: todos.spec.js >> Gestión de Tareas — Agregar >> Puede agregar una tarea presionando Enter
- Location: playwright\tests\todos.spec.js:69:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-cy=todo-list]')
Expected: visible
Timeout: 8000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 8000ms
  - waiting for locator('[data-cy=todo-list]')

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
  1   | // playwright/tests/todos.spec.js
  2   | // ══════════════════════════════════════════════════════════════
  3   | // Mismos escenarios que cypress/e2e/todos.cy.js
  4   | // ══════════════════════════════════════════════════════════════
  5   | 
  6   | import { test, expect } from '@playwright/test'
  7   | 
  8   | const TEST_EMAIL    = process.env.TEST_EMAIL    || 'test@taskflow.com'
  9   | const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Test1234!'
  10  | 
  11  | // Helper de login — equivalente al cy.loginUI() de Cypress
  12  | async function loginUI(page) {
  13  |   await page.goto('/login')
  14  |   await page.locator('[data-cy=email-input]').fill(TEST_EMAIL)
  15  |   await page.locator('[data-cy=password-input]').fill(TEST_PASSWORD)
  16  |   await page.locator('[data-cy=submit-btn]').click()
> 17  |   await expect(page.locator('[data-cy=todo-list]')).toBeVisible({ timeout: 8000 })
      |                                                     ^ Error: expect(locator).toBeVisible() failed
  18  | }
  19  | 
  20  | // Helper addTodo — equivalente al cy.addTodo() de Cypress
  21  | async function addTodo(page, text) {
  22  |   await page.locator('[data-cy=todo-input]').fill(text)
  23  |   await page.locator('[data-cy=add-btn]').click()
  24  | }
  25  | 
  26  | // Login antes de cada test del grupo
  27  | test.beforeEach(async ({ page }) => {
  28  |   await loginUI(page)
  29  | })
  30  | 
  31  | // ─────────────────────────────────────────────
  32  | // INTERFAZ PRINCIPAL
  33  | // ─────────────────────────────────────────────
  34  | test.describe('Gestión de Tareas — Interfaz', () => {
  35  | 
  36  |   test('Muestra el email del usuario en el navbar', async ({ page }) => {
  37  |     await expect(page.locator('[data-cy=user-email]')).toContainText(TEST_EMAIL)
  38  |   })
  39  | 
  40  |   test('Muestra el título de la página', async ({ page }) => {
  41  |     await expect(page.locator('[data-cy=todo-page-title]')).toBeVisible()
  42  |     await expect(page.locator('[data-cy=todo-page-title]')).toContainText('tareas')
  43  |   })
  44  | 
  45  |   test('Muestra los filtros disponibles', async ({ page }) => {
  46  |     await expect(page.locator('[data-cy=filter-todas]')).toBeVisible()
  47  |     await expect(page.locator('[data-cy=filter-activas]')).toBeVisible()
  48  |     await expect(page.locator('[data-cy=filter-completadas]')).toBeVisible()
  49  |   })
  50  | 
  51  | })
  52  | 
  53  | // ─────────────────────────────────────────────
  54  | // AGREGAR TAREAS
  55  | // ─────────────────────────────────────────────
  56  | test.describe('Gestión de Tareas — Agregar', () => {
  57  | 
  58  |   test('Puede agregar una tarea', async ({ page }) => {
  59  |     const text = `Tarea de prueba ${Date.now()}`
  60  |     await addTodo(page, text)
  61  |     await expect(page.locator('[data-cy=todo-text]').last()).toContainText(text)
  62  |   })
  63  | 
  64  |   test('El input se limpia al agregar una tarea', async ({ page }) => {
  65  |     await addTodo(page, 'Limpieza del input')
  66  |     await expect(page.locator('[data-cy=todo-input]')).toHaveValue('')
  67  |   })
  68  | 
  69  |   test('Puede agregar una tarea presionando Enter', async ({ page }) => {
  70  |     const text = `Enter test ${Date.now()}`
  71  |     await page.locator('[data-cy=todo-input]').fill(text)
  72  |     await page.keyboard.press('Enter')
  73  |     await expect(page.locator('[data-cy=todo-text]').last()).toContainText(text)
  74  |   })
  75  | 
  76  |   test('Muestra error al intentar agregar tarea vacía', async ({ page }) => {
  77  |     await page.locator('[data-cy=add-btn]').click()
  78  |     await expect(page.locator('[data-cy=error-message]')).toBeVisible()
  79  |   })
  80  | 
  81  |   test('Muestra error si la tarea tiene menos de 3 caracteres', async ({ page }) => {
  82  |     await page.locator('[data-cy=todo-input]').fill('AB')
  83  |     await page.locator('[data-cy=add-btn]').click()
  84  |     await expect(page.locator('[data-cy=error-message]')).toBeVisible()
  85  |   })
  86  | 
  87  | })
  88  | 
  89  | // ─────────────────────────────────────────────
  90  | // COMPLETAR TAREAS
  91  | // ─────────────────────────────────────────────
  92  | test.describe('Gestión de Tareas — Completar', () => {
  93  | 
  94  |   test.beforeEach(async ({ page }) => {
  95  |     await addTodo(page, `Completar ${Date.now()}`)
  96  |   })
  97  | 
  98  |   test('Puede marcar una tarea como completada', async ({ page }) => {
  99  |     await page.locator('[data-cy=todo-item]').last().locator('[data-cy=toggle-btn]').click()
  100 |     await expect(page.locator('[data-cy=todo-item]').last()).toHaveAttribute('data-completed', 'true')
  101 |   })
  102 | 
  103 |   test('Puede desmarcar una tarea completada', async ({ page }) => {
  104 |     const lastItem = page.locator('[data-cy=todo-item]').last()
  105 |     await lastItem.locator('[data-cy=toggle-btn]').click()
  106 |     await lastItem.locator('[data-cy=toggle-btn]').click()
  107 |     await expect(lastItem).toHaveAttribute('data-completed', 'false')
  108 |   })
  109 | 
  110 | })
  111 | 
  112 | // ─────────────────────────────────────────────
  113 | // ELIMINAR TAREAS
  114 | // ─────────────────────────────────────────────
  115 | test.describe('Gestión de Tareas — Eliminar', () => {
  116 | 
  117 |   test('Puede eliminar una tarea', async ({ page }) => {
```