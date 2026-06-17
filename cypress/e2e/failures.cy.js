// cypress/e2e/failures.cy.js
//
// ══════════════════════════════════════════════════════════════════
//  SUITE DE FALLOS INTENCIONALES — Autonomous QA Demo
// ══════════════════════════════════════════════════════════════════
//
// Propósito: demostrar que el pipeline detecta fallos reales,
// los reporta en Cypress Cloud y dispara al agente autónomo
// para crear tickets en Jira.
//
// IMPORTANTE: estos tests están marcados con { failOnStatusCode: false }
// o usan assertiones deliberadamente incorrectas para forzar el fallo.
// Cada test documenta QUÉ bug simula y cuál sería el fix real.
// ══════════════════════════════════════════════════════════════════

const TEST_EMAIL    = Cypress.env('TEST_EMAIL')
const TEST_PASSWORD = Cypress.env('TEST_PASSWORD')

describe('🔴 Fallos Intencionales — Autonomous QA Demo', () => {

  // ──────────────────────────────────────────────
  // CATEGORÍA 1: Rutas y navegación
  // ──────────────────────────────────────────────
  describe('Navegación', () => {

    it('[FAIL] Ruta /dashboard no existe — debe retornar 404', () => {
      // BUG SIMULADO: la app no tiene página /dashboard
      // pero el test asume que debería existir.
      // Fix real: crear el componente Dashboard o redirigir correctamente.
      cy.visit('/dashboard', { failOnStatusCode: false })
      cy.get('[data-cy=dashboard-title]', { timeout: 4000 })
        .should('be.visible')
      // ↑ Falla porque [data-cy=dashboard-title] no existe en /dashboard
    })

    it('[FAIL] Enlace "¿Olvidaste tu contraseña?" debe existir en login', () => {
      // BUG SIMULADO: la app no tiene flujo de recuperación de contraseña.
      // Fix real: agregar enlace y página /forgot-password.
      cy.visit('/login')
      cy.get('[data-cy=forgot-password-link]', { timeout: 4000 })
        .should('be.visible')
        .and('have.attr', 'href', '/forgot-password')
      // ↑ Falla porque el selector no existe en la UI actual
    })

    it('[FAIL] Página /profile debe ser accesible estando autenticado', () => {
      // BUG SIMULADO: no existe página de perfil de usuario.
      // Fix real: crear ruta /profile con datos del usuario.
      cy.loginUI(TEST_EMAIL, TEST_PASSWORD)
      cy.visit('/profile', { failOnStatusCode: false })
      cy.get('[data-cy=profile-page]', { timeout: 4000 })
        .should('be.visible')
      // ↑ Falla porque la ruta redirige a /app (no hay /profile)
    })

  })

  // ──────────────────────────────────────────────
  // CATEGORÍA 2: Validaciones de formulario
  // ──────────────────────────────────────────────
  describe('Validaciones', () => {

    it('[FAIL] Input de tarea debe rechazar texto con solo espacios', () => {
      // BUG SIMULADO: probar si "   " (espacios) pasa la validación.
      // Fix real: agregar .trim() antes de validar longitud mínima.
      cy.loginUI(TEST_EMAIL, TEST_PASSWORD)
      cy.get('[data-cy=todo-input]').type('   ')
      cy.get('[data-cy=add-btn]').click()
      // Asumimos que NO debe crearse la tarea y SÍ debe aparecer error
      cy.get('[data-cy=todo-item]').should('have.length', 0)
      // ↑ Puede fallar si la app agrega la tarea con espacios
    })

    it('[FAIL] Email con formato inválido debe mostrar error inmediato', () => {
      // BUG SIMULADO: verificar si la validación ocurre antes del submit.
      // Fix real: agregar validación onBlur en el campo email.
      cy.visit('/login')
      cy.get('[data-cy=email-input]').type('esto-no-es-un-email').blur()
      // Esperamos error inmediato sin necesidad de hacer click en submit
      cy.get('[data-cy=inline-email-error]', { timeout: 3000 })
        .should('be.visible')
      // ↑ Falla porque la app solo valida al hacer submit
    })

    it('[FAIL] Tarea con 120+ caracteres debe ser rechazada', () => {
      // BUG SIMULADO: el input tiene maxLength=120 en HTML pero
      // no hay validación explícita en la lógica de negocio.
      // Fix real: agregar validación de longitud máxima en handleAdd.
      cy.loginUI(TEST_EMAIL, TEST_PASSWORD)
      const textoLargo = 'A'.repeat(125)
      // Forzamos el valor sin respetar el maxLength del HTML
      cy.get('[data-cy=todo-input]').invoke('val', textoLargo).trigger('input')
      cy.get('[data-cy=add-btn]').click()
      cy.get('[data-cy=error-message]')
        .should('be.visible')
        .and('contain', '120')
      // ↑ Falla porque no hay validación de máximo en el handler
    })

  })

  // ──────────────────────────────────────────────
  // CATEGORÍA 3: Rendimiento y UX
  // ──────────────────────────────────────────────
  describe('Rendimiento', () => {

    it('[FAIL] La app debe cargar en menos de 1500ms', () => {
      // BUG SIMULADO: umbral muy estricto para demostrar fallo de performance.
      // Fix real: code splitting, lazy loading de componentes.
      const start = Date.now()
      cy.visit('/')
      cy.get('[data-cy=login-form]').should('be.visible').then(() => {
        const duration = Date.now() - start
        // 1500ms es muy estricto; en CI con cold start suele ser más
        expect(duration).to.be.lessThan(1500)
      })
    })

    it('[FAIL] El contador de tareas pendientes debe actualizarse en tiempo real', () => {
      // BUG SIMULADO: verificar que el contador es correcto ANTES
      // de que termine la petición a Supabase (optimistic update).
      cy.loginUI(TEST_EMAIL, TEST_PASSWORD)
      cy.get('[data-cy=active-count]').invoke('text').then((textoInicial) => {
        const countInicial = parseInt(textoInicial)
        cy.get('[data-cy=todo-input]').type(`Tiempo real ${Date.now()}`)
        cy.get('[data-cy=add-btn]').click()
        // Verificar INMEDIATAMENTE (sin esperar respuesta de Supabase)
        cy.get('[data-cy=active-count]', { timeout: 100 })
          .should('contain', countInicial + 1)
        // ↑ Puede fallar si el update optimista no está implementado correctamente
      })
    })

  })

  // ──────────────────────────────────────────────
  // CATEGORÍA 4: Seguridad básica
  // ──────────────────────────────────────────────
  describe('Seguridad', () => {

    it('[FAIL] No debe ser posible acceder a /app con token expirado', () => {
      // BUG SIMULADO: simulamos un token inválido en localStorage
      // y verificamos que la app lo detecta y redirige.
      cy.visit('/login')
      // Inyectar token falso directamente en localStorage
      cy.window().then((win) => {
        win.localStorage.setItem(
          'sb-iwooebjhtgrogmgbyaqv-auth-token',
          JSON.stringify({ access_token: 'token-invalido-expirado', expires_at: 1 })
        )
      })
      cy.visit('/app')
      // La app debería detectar el token inválido y redirigir a /login
      cy.url({ timeout: 5000 }).should('include', '/login')
      // ↑ Puede fallar si Supabase no valida el token antes del primer render
    })

    it('[FAIL] El campo de tarea no debe ejecutar scripts XSS', () => {
      // BUG SIMULADO: verificar que texto con <script> se muestra como texto
      // y no se ejecuta como HTML.
      cy.loginUI(TEST_EMAIL, TEST_PASSWORD)
      const payload = '<script>window.__xss_executed = true</script>XSS Test'
      cy.addTodo(payload)
      // Verificar que el script NO se ejecutó
      cy.window().its('__xss_executed').should('be.undefined')
      // Y que el texto se muestra escapado
      cy.get('[data-cy=todo-text]').last().should('contain', 'XSS Test')
      // Limpiar
      cy.get('[data-cy=todo-item]').last().find('[data-cy=delete-btn]').click({ force: true })
    })

  })

})
