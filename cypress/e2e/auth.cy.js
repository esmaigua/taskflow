// cypress/e2e/auth.cy.js
// Pruebas del flujo de autenticación: Login y Registro

const TEST_EMAIL = Cypress.env('TEST_EMAIL')
const TEST_PASSWORD = Cypress.env('TEST_PASSWORD')

describe('Autenticación', () => {

  // ─────────────────────────────────────────────
  // REDIRECCIONES (rutas protegidas)
  // ─────────────────────────────────────────────
  describe('Rutas protegidas', () => {
    it('Redirige a /login si no hay sesión y se accede a /app', () => {
      cy.visit('/app')
      cy.url().should('include', '/login')
    })

    it('Redirige a /app si ya hay sesión y se accede a /login', () => {
      cy.loginUI(TEST_EMAIL, TEST_PASSWORD)
      cy.visit('/login')
      cy.url().should('include', '/app')
    })
  })

  // ─────────────────────────────────────────────
  // PÁGINA DE LOGIN
  // ─────────────────────────────────────────────
  describe('Página de Login', () => {
    beforeEach(() => {
      cy.visit('/login')
    })

    it('Muestra el formulario de login', () => {
      cy.get('[data-cy=login-form]').should('be.visible')
      cy.get('[data-cy=email-input]').should('be.visible')
      cy.get('[data-cy=password-input]').should('be.visible')
      cy.get('[data-cy=submit-btn]').should('be.visible')
    })

    it('Muestra error con correo vacío', () => {
      cy.get('[data-cy=submit-btn]').click()
      cy.get('[data-cy=auth-error]').should('be.visible')
    })

    it('Muestra error con contraseña vacía', () => {
      cy.get('[data-cy=email-input]').type('alguien@correo.com')
      cy.get('[data-cy=submit-btn]').click()
      cy.get('[data-cy=auth-error]').should('be.visible')
    })

    it('Muestra error con credenciales incorrectas', () => {
      cy.get('[data-cy=email-input]').type('noexiste@correo.com')
      cy.get('[data-cy=password-input]').type('claveincorrecta')
      cy.get('[data-cy=submit-btn]').click()
      cy.get('[data-cy=auth-error]').should('be.visible').and('contain', 'incorrectos')
    })

    it('Inicia sesión con credenciales correctas y redirige a /app', () => {
      cy.get('[data-cy=email-input]').type(TEST_EMAIL)
      cy.get('[data-cy=password-input]').type(TEST_PASSWORD)
      cy.get('[data-cy=submit-btn]').click()
      cy.url().should('include', '/app')
      cy.get('[data-cy=user-email]').should('contain', TEST_EMAIL)
    })

    it('Tiene un enlace a la página de registro', () => {
      cy.get('[data-cy=go-register]').should('be.visible').click()
      cy.url().should('include', '/register')
    })
  })

  // ─────────────────────────────────────────────
  // PÁGINA DE REGISTRO
  // ─────────────────────────────────────────────
  describe('Página de Registro', () => {
    beforeEach(() => {
      cy.visit('/register')
    })

    it('Muestra el formulario de registro', () => {
      cy.get('[data-cy=register-form]').should('be.visible')
      cy.get('[data-cy=email-input]').should('be.visible')
      cy.get('[data-cy=password-input]').should('be.visible')
      cy.get('[data-cy=confirm-input]').should('be.visible')
    })

    it('Muestra error si las contraseñas no coinciden', () => {
      cy.get('[data-cy=email-input]').type('nuevo@correo.com')
      cy.get('[data-cy=password-input]').type('Clave1234')
      cy.get('[data-cy=confirm-input]').type('ClaveDistinta')
      cy.get('[data-cy=submit-btn]').click()
      cy.get('[data-cy=auth-error]').should('contain', 'coinciden')
    })

    it('Muestra error si la contraseña es muy corta', () => {
      cy.get('[data-cy=email-input]').type('nuevo@correo.com')
      cy.get('[data-cy=password-input]').type('123')
      cy.get('[data-cy=confirm-input]').type('123')
      cy.get('[data-cy=submit-btn]').click()
      cy.get('[data-cy=auth-error]').should('contain', '6 caracteres')
    })

    it('Tiene un enlace a la página de login', () => {
      cy.get('[data-cy=go-login]').should('be.visible').click()
      cy.url().should('include', '/login')
    })
  })

  // ─────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────
  describe('Cerrar sesión', () => {
    it('Puede cerrar sesión y redirige a /login', () => {
      cy.loginUI(TEST_EMAIL, TEST_PASSWORD)
      cy.get('[data-cy=logout-btn]').click()
      cy.url().should('include', '/login')
    })

    it('Después de cerrar sesión no puede acceder a /app', () => {
      cy.loginUI(TEST_EMAIL, TEST_PASSWORD)
      cy.get('[data-cy=logout-btn]').click()
      cy.visit('/app')
      cy.url().should('include', '/login')
    })
  })
})
