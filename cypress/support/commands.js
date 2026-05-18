// cypress/support/commands.js

// ─── Login programático (rápido, sin pasar por la UI) ───────────────────────
// Ideal para usar en beforeEach de tests que no prueban el login en sí
Cypress.Commands.add('loginByApi', (email, password) => {
  cy.request({
    method: 'POST',
    url: `${Cypress.env('SUPABASE_URL') || 'https://xxxx.supabase.co'}/auth/v1/token?grant_type=password`,
    headers: {
      'apikey': Cypress.env('SUPABASE_ANON_KEY') || '',
      'Content-Type': 'application/json',
    },
    body: { email, password },
    failOnStatusCode: false,
  }).then((response) => {
    if (response.status === 200) {
      // Guardar sesión en localStorage como lo hace Supabase
      const session = response.body
      window.localStorage.setItem(
        `sb-${Cypress.env('SUPABASE_PROJECT_ID')}-auth-token`,
        JSON.stringify(session)
      )
    }
  })
})

// ─── Login via UI ────────────────────────────────────────────────────────────
Cypress.Commands.add('loginUI', (email, password) => {
  cy.visit('/login')
  cy.get('[data-cy=email-input]').type(email)
  cy.get('[data-cy=password-input]').type(password)
  cy.get('[data-cy=submit-btn]').click()
  cy.url().should('include', '/app')
})

// ─── Agregar una tarea (estando en /app) ─────────────────────────────────────
Cypress.Commands.add('addTodo', (text) => {
  cy.get('[data-cy=todo-input]').clear().type(text)
  cy.get('[data-cy=add-btn]').click()
})

// ─── Logout ──────────────────────────────────────────────────────────────────
Cypress.Commands.add('logout', () => {
  cy.get('[data-cy=logout-btn]').click()
  cy.url().should('include', '/login')
})
