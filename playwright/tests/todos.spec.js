// playwright/tests/todos.spec.js
// ══════════════════════════════════════════════════════════════
// Mismos escenarios que cypress/e2e/todos.cy.js
// ══════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'

const TEST_EMAIL    = process.env.TEST_EMAIL    || 'test@taskflow.com'
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Test1234!'

// Helper de login — equivalente al cy.loginUI() de Cypress
async function loginUI(page) {
  await page.goto('/login')
  await page.locator('[data-cy=email-input]').fill(TEST_EMAIL)
  await page.locator('[data-cy=password-input]').fill(TEST_PASSWORD)
  await page.locator('[data-cy=submit-btn]').click()
  await expect(page.locator('[data-cy=todo-list]')).toBeVisible({ timeout: 8000 })
}

// Helper addTodo — equivalente al cy.addTodo() de Cypress
async function addTodo(page, text) {
  await page.locator('[data-cy=todo-input]').fill(text)
  await page.locator('[data-cy=add-btn]').click()
}

// Login antes de cada test del grupo
test.beforeEach(async ({ page }) => {
  await loginUI(page)
})

// ─────────────────────────────────────────────
// INTERFAZ PRINCIPAL
// ─────────────────────────────────────────────
test.describe('Gestión de Tareas — Interfaz', () => {

  test('Muestra el email del usuario en el navbar', async ({ page }) => {
    await expect(page.locator('[data-cy=user-email]')).toContainText(TEST_EMAIL)
  })

  test('Muestra el título de la página', async ({ page }) => {
    await expect(page.locator('[data-cy=todo-page-title]')).toBeVisible()
    await expect(page.locator('[data-cy=todo-page-title]')).toContainText('tareas')
  })

  test('Muestra los filtros disponibles', async ({ page }) => {
    await expect(page.locator('[data-cy=filter-todas]')).toBeVisible()
    await expect(page.locator('[data-cy=filter-activas]')).toBeVisible()
    await expect(page.locator('[data-cy=filter-completadas]')).toBeVisible()
  })

})

// ─────────────────────────────────────────────
// AGREGAR TAREAS
// ─────────────────────────────────────────────
test.describe('Gestión de Tareas — Agregar', () => {

  test('Puede agregar una tarea', async ({ page }) => {
    const text = `Tarea de prueba ${Date.now()}`
    await addTodo(page, text)
    await expect(page.locator('[data-cy=todo-text]').last()).toContainText(text)
  })

  test('El input se limpia al agregar una tarea', async ({ page }) => {
    await addTodo(page, 'Limpieza del input')
    await expect(page.locator('[data-cy=todo-input]')).toHaveValue('')
  })

  test('Puede agregar una tarea presionando Enter', async ({ page }) => {
    const text = `Enter test ${Date.now()}`
    await page.locator('[data-cy=todo-input]').fill(text)
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-cy=todo-text]').last()).toContainText(text)
  })

  test('Muestra error al intentar agregar tarea vacía', async ({ page }) => {
    await page.locator('[data-cy=add-btn]').click()
    await expect(page.locator('[data-cy=error-message]')).toBeVisible()
  })

  test('Muestra error si la tarea tiene menos de 3 caracteres', async ({ page }) => {
    await page.locator('[data-cy=todo-input]').fill('AB')
    await page.locator('[data-cy=add-btn]').click()
    await expect(page.locator('[data-cy=error-message]')).toBeVisible()
  })

})

// ─────────────────────────────────────────────
// COMPLETAR TAREAS
// ─────────────────────────────────────────────
test.describe('Gestión de Tareas — Completar', () => {

  test.beforeEach(async ({ page }) => {
    await addTodo(page, `Completar ${Date.now()}`)
  })

  test('Puede marcar una tarea como completada', async ({ page }) => {
    await page.locator('[data-cy=todo-item]').last().locator('[data-cy=toggle-btn]').click()
    await expect(page.locator('[data-cy=todo-item]').last()).toHaveAttribute('data-completed', 'true')
  })

  test('Puede desmarcar una tarea completada', async ({ page }) => {
    const lastItem = page.locator('[data-cy=todo-item]').last()
    await lastItem.locator('[data-cy=toggle-btn]').click()
    await lastItem.locator('[data-cy=toggle-btn]').click()
    await expect(lastItem).toHaveAttribute('data-completed', 'false')
  })

})

// ─────────────────────────────────────────────
// ELIMINAR TAREAS
// ─────────────────────────────────────────────
test.describe('Gestión de Tareas — Eliminar', () => {

  test('Puede eliminar una tarea', async ({ page }) => {
    const text = `Eliminar ${Date.now()}`
    await addTodo(page, text)
    // Hover para que aparezca el botón (CSS opacity: 0 → 1 en hover)
    const lastItem = page.locator('[data-cy=todo-item]').last()
    await lastItem.hover()
    await lastItem.locator('[data-cy=delete-btn]').click()
    await expect(page.locator('[data-cy=todo-text]')).not.toContainText(text)
  })

})

// ─────────────────────────────────────────────
// EDITAR TAREAS
// ─────────────────────────────────────────────
test.describe('Gestión de Tareas — Editar', () => {

  test.beforeEach(async ({ page }) => {
    await addTodo(page, `Original ${Date.now()}`)
  })

  test('Puede abrir el modo edición', async ({ page }) => {
    const lastItem = page.locator('[data-cy=todo-item]').last()
    await lastItem.hover()
    await lastItem.locator('[data-cy=edit-btn]').click()
    await expect(page.locator('[data-cy=edit-input]')).toBeVisible()
  })

  test('Puede guardar el texto editado', async ({ page }) => {
    const nuevoTexto = `Editado ${Date.now()}`
    const lastItem = page.locator('[data-cy=todo-item]').last()
    await lastItem.hover()
    await lastItem.locator('[data-cy=edit-btn]').click()
    await page.locator('[data-cy=edit-input]').fill(nuevoTexto)
    await page.locator('[data-cy=save-edit-btn]').click()
    await expect(lastItem.locator('[data-cy=todo-text]')).toContainText(nuevoTexto)
  })

  test('Puede cancelar la edición', async ({ page }) => {
    const lastItem = page.locator('[data-cy=todo-item]').last()
    const textoOriginal = await lastItem.locator('[data-cy=todo-text]').textContent()
    await lastItem.hover()
    await lastItem.locator('[data-cy=edit-btn]').click()
    await page.locator('[data-cy=edit-input]').fill('Texto que no se guarda')
    await page.locator('[data-cy=cancel-edit-btn]').click()
    await expect(lastItem.locator('[data-cy=todo-text]')).toContainText(textoOriginal.trim())
  })

})

// ─────────────────────────────────────────────
// FILTROS
// ─────────────────────────────────────────────
test.describe('Gestión de Tareas — Filtros', () => {

  test.beforeEach(async ({ page }) => {
    await addTodo(page, `Activa ${Date.now()}`)
    await addTodo(page, `Completar ${Date.now()}`)
    await page.locator('[data-cy=todo-item]').last().locator('[data-cy=toggle-btn]').click()
  })

  test('El filtro "Completadas" solo muestra completadas', async ({ page }) => {
    await page.locator('[data-cy=filter-completadas]').click()
    const items = page.locator('[data-cy=todo-item]')
    const count = await items.count()
    for (let i = 0; i < count; i++) {
      await expect(items.nth(i)).toHaveAttribute('data-completed', 'true')
    }
  })

  test('El filtro "Activas" solo muestra pendientes', async ({ page }) => {
    await page.locator('[data-cy=filter-activas]').click()
    const items = page.locator('[data-cy=todo-item]')
    const count = await items.count()
    for (let i = 0; i < count; i++) {
      await expect(items.nth(i)).toHaveAttribute('data-completed', 'false')
    }
  })

  test('El filtro activo tiene la clase "active"', async ({ page }) => {
    await page.locator('[data-cy=filter-activas]').click()
    await expect(page.locator('[data-cy=filter-activas]')).toHaveClass(/active/)
    await expect(page.locator('[data-cy=filter-todas]')).not.toHaveClass(/active/)
  })

})

// ─────────────────────────────────────────────
// LIMPIAR COMPLETADAS
// ─────────────────────────────────────────────
test.describe('Gestión de Tareas — Limpiar completadas', () => {

  test('Elimina solo las tareas completadas', async ({ page }) => {
    const textoActiva = `Activa ${Date.now()}`
    await addTodo(page, textoActiva)
    await addTodo(page, `Completada ${Date.now()}`)
    await page.locator('[data-cy=todo-item]').last().locator('[data-cy=toggle-btn]').click()
    await page.locator('[data-cy=clear-completed]').click()
    await expect(page.locator('[data-cy=todo-text]')).toContainText(textoActiva)
    const items = page.locator('[data-cy=todo-item]')
    const count = await items.count()
    for (let i = 0; i < count; i++) {
      await expect(items.nth(i)).toHaveAttribute('data-completed', 'false')
    }
  })

})
