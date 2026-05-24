// cypress/support/commands.js

// ─── Login via UI ─────────────────────────────────────────────
Cypress.Commands.add('loginUI', (email, password) => {
  cy.visit('/login')
  cy.get('[data-cy=email-input]').type(email)
  cy.get('[data-cy=password-input]').type(password)
  cy.get('[data-cy=submit-btn]').click()
  cy.url().should('include', '/app')
})

// ─── Agregar tarea ────────────────────────────────────────────
Cypress.Commands.add('addTodo', (text) => {
  cy.get('[data-cy=todo-input]').clear().type(text)
  cy.get('[data-cy=add-btn]').click()
})

// ─── Logout ───────────────────────────────────────────────────
Cypress.Commands.add('logout', () => {
  cy.get('[data-cy=logout-btn]').click()
  cy.url().should('include', '/login')
})

// ─── Limpiar TODAS las tareas del usuario de prueba ──────────
// Necesario porque la cuenta acumula tareas de runs anteriores
// y cuando hay 50+ tareas la lista tarda demasiado en cargar
Cypress.Commands.add('clearAllTodos', () => {
  // Eliminar todas las tareas visibles usando el botón de cada una
  cy.get('body').then(($body) => {
    if ($body.find('[data-cy=clear-completed]').length > 0) {
      // Completar todas las activas primero para poder usar clear-completed
      cy.get('[data-cy=todo-item]').each(($el) => {
        if ($el.attr('data-completed') === 'false') {
          cy.wrap($el).find('[data-cy=toggle-btn]').click()
        }
      })
      cy.get('[data-cy=clear-completed]').click()
    }
    // Eliminar las que queden
    cy.get('[data-cy=todo-item]').then(($items) => {
      if ($items.length > 0) {
        cy.get('[data-cy=todo-item]').each(($el) => {
          cy.wrap($el).find('[data-cy=delete-btn]').click({ force: true })
        })
      }
    })
  })
})
