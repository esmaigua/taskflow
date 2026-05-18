// cypress/e2e/smoke.cy.js
// Tests CRÍTICOS que se corren en producción (rápidos, no destructivos)
// Solo verifican que lo esencial funciona tras un deploy

const TEST_EMAIL = Cypress.env('TEST_EMAIL')
const TEST_PASSWORD = Cypress.env('TEST_PASSWORD')

describe('🔥 Smoke Tests — Producción', () => {

  it('La app carga correctamente', () => {
    cy.visit('/')
    cy.get('body').should('be.visible')
    // No debe mostrar pantalla en blanco
    cy.get('#root').children().should('have.length.greaterThan', 0)
  })

  it('La página de login es accesible', () => {
    cy.visit('/login')
    cy.get('[data-cy=login-form]').should('be.visible')
    cy.get('[data-cy=email-input]').should('be.visible')
    cy.get('[data-cy=submit-btn]').should('be.visible')
  })

  it('La página de registro es accesible', () => {
    cy.visit('/register')
    cy.get('[data-cy=register-form]').should('be.visible')
  })

  it('Las rutas protegidas redirigen a login', () => {
    cy.visit('/app')
    cy.url().should('include', '/login')
  })

  it('El login funciona con usuario de prueba', () => {
    cy.visit('/login')
    cy.get('[data-cy=email-input]').type(TEST_EMAIL)
    cy.get('[data-cy=password-input]').type(TEST_PASSWORD)
    cy.get('[data-cy=submit-btn]').click()
    cy.url().should('include', '/app')
    cy.get('[data-cy=todo-list]').should('be.visible')
  })

  it('El logout funciona', () => {
    cy.loginUI(TEST_EMAIL, TEST_PASSWORD)
    cy.get('[data-cy=logout-btn]').click()
    cy.url().should('include', '/login')
  })
})
