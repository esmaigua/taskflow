// cypress/e2e/todos.cy.js
// Pruebas de la gestión de tareas (requiere estar autenticado)

const TEST_EMAIL = Cypress.env('TEST_EMAIL')
const TEST_PASSWORD = Cypress.env('TEST_PASSWORD')

describe('Gestión de Tareas', () => {

  // Iniciar sesión antes de cada test via UI
  beforeEach(() => {
    cy.loginUI(TEST_EMAIL, TEST_PASSWORD)
    // Esperar a que cargue la lista
    cy.get('[data-cy=todo-list]', { timeout: 8000 }).should('be.visible')
  })

  // ─────────────────────────────────────────────
  // PÁGINA PRINCIPAL
  // ─────────────────────────────────────────────
  describe('Interfaz principal', () => {
    it('Muestra el email del usuario en el navbar', () => {
      cy.get('[data-cy=user-email]').should('contain', TEST_EMAIL)
    })

    it('Muestra el título de la página', () => {
      cy.get('[data-cy=todo-page-title]').should('be.visible').and('contain', 'tareas')
    })

    it('Muestra los filtros disponibles', () => {
      cy.get('[data-cy=filter-todas]').should('be.visible')
      cy.get('[data-cy=filter-activas]').should('be.visible')
      cy.get('[data-cy=filter-completadas]').should('be.visible')
    })
  })

  // ─────────────────────────────────────────────
  // AGREGAR TAREAS
  // ─────────────────────────────────────────────
  describe('Agregar tareas', () => {
    it('Puede agregar una tarea', () => {
      const text = `Tarea de prueba ${Date.now()}`
      cy.addTodo(text)
      cy.get('[data-cy=todo-text]').last().should('contain', text)
    })

    it('El input se limpia al agregar una tarea', () => {
      cy.addTodo('Limpieza del input')
      cy.get('[data-cy=todo-input]').should('have.value', '')
    })

    it('Puede agregar una tarea presionando Enter', () => {
      const text = `Enter test ${Date.now()}`
      cy.get('[data-cy=todo-input]').type(`${text}{enter}`)
      cy.get('[data-cy=todo-text]').last().should('contain', text)
    })

    it('Muestra error al intentar agregar tarea vacía', () => {
      cy.get('[data-cy=add-btn]').click()
      cy.get('[data-cy=error-message]').should('be.visible')
    })

    it('Muestra error si la tarea tiene menos de 3 caracteres', () => {
      cy.get('[data-cy=todo-input]').type('AB')
      cy.get('[data-cy=add-btn]').click()
      cy.get('[data-cy=error-message]').should('be.visible')
    })
  })

  // ─────────────────────────────────────────────
  // COMPLETAR TAREAS
  // ─────────────────────────────────────────────
  describe('Completar tareas', () => {
    beforeEach(() => {
      cy.addTodo(`Completar ${Date.now()}`)
    })

    it('Puede marcar una tarea como completada', () => {
      cy.get('[data-cy=todo-item]').last().find('[data-cy=toggle-btn]').click()
      cy.get('[data-cy=todo-item]').last().should('have.attr', 'data-completed', 'true')
    })

    it('Puede desmarcar una tarea completada', () => {
      cy.get('[data-cy=todo-item]').last().find('[data-cy=toggle-btn]').click()
      cy.get('[data-cy=todo-item]').last().find('[data-cy=toggle-btn]').click()
      cy.get('[data-cy=todo-item]').last().should('have.attr', 'data-completed', 'false')
    })
  })

  // ─────────────────────────────────────────────
  // ELIMINAR TAREAS
  // ─────────────────────────────────────────────
  describe('Eliminar tareas', () => {
    it('Puede eliminar una tarea', () => {
      const text = `Eliminar ${Date.now()}`
      cy.addTodo(text)
      cy.get('[data-cy=todo-item]').last().find('[data-cy=delete-btn]').click({ force: true })
      cy.get('[data-cy=todo-text]').should('not.contain', text)
    })
  })

  // ─────────────────────────────────────────────
  // EDITAR TAREAS
  // ─────────────────────────────────────────────
  describe('Editar tareas', () => {
    beforeEach(() => {
      cy.addTodo(`Original ${Date.now()}`)
    })

    it('Puede abrir el modo edición', () => {
      cy.get('[data-cy=todo-item]').last().find('[data-cy=edit-btn]').click({ force: true })
      cy.get('[data-cy=edit-input]').should('be.visible')
    })

    it('Puede guardar el texto editado', () => {
      const nuevoTexto = `Editado ${Date.now()}`
      cy.get('[data-cy=todo-item]').last().find('[data-cy=edit-btn]').click({ force: true })
      cy.get('[data-cy=edit-input]').clear().type(nuevoTexto)
      cy.get('[data-cy=save-edit-btn]').click()
      cy.get('[data-cy=todo-item]').last().find('[data-cy=todo-text]').should('contain', nuevoTexto)
    })

    it('Puede cancelar la edición', () => {
      cy.get('[data-cy=todo-item]').last().find('[data-cy=todo-text]').invoke('text').then((textoOriginal) => {
        cy.get('[data-cy=todo-item]').last().find('[data-cy=edit-btn]').click({ force: true })
        cy.get('[data-cy=edit-input]').clear().type('Texto que no se guarda')
        cy.get('[data-cy=cancel-edit-btn]').click()
        cy.get('[data-cy=todo-item]').last().find('[data-cy=todo-text]').should('contain', textoOriginal.trim())
      })
    })
  })

  // ─────────────────────────────────────────────
  // FILTROS
  // ─────────────────────────────────────────────
  describe('Filtros', () => {
    beforeEach(() => {
      // Crear 2 tareas y completar 1
      cy.addTodo(`Activa ${Date.now()}`)
      cy.addTodo(`Completar ${Date.now()}`)
      cy.get('[data-cy=todo-item]').last().find('[data-cy=toggle-btn]').click()
    })

    it('El filtro "Completadas" solo muestra completadas', () => {
      cy.get('[data-cy=filter-completadas]').click()
      cy.get('[data-cy=todo-item]').each(($el) => {
        cy.wrap($el).should('have.attr', 'data-completed', 'true')
      })
    })

    it('El filtro "Activas" solo muestra pendientes', () => {
      cy.get('[data-cy=filter-activas]').click()
      cy.get('[data-cy=todo-item]').each(($el) => {
        cy.wrap($el).should('have.attr', 'data-completed', 'false')
      })
    })

    it('El filtro activo tiene la clase "active"', () => {
      cy.get('[data-cy=filter-activas]').click()
      cy.get('[data-cy=filter-activas]').should('have.class', 'active')
      cy.get('[data-cy=filter-todas]').should('not.have.class', 'active')
    })
  })

  // ─────────────────────────────────────────────
  // LIMPIAR COMPLETADAS
  // ─────────────────────────────────────────────
  describe('Limpiar completadas', () => {
    it('Elimina solo las tareas completadas', () => {
      const textoActiva = `Activa ${Date.now()}`
      cy.addTodo(textoActiva)
      cy.addTodo(`Completada ${Date.now()}`)
      cy.get('[data-cy=todo-item]').last().find('[data-cy=toggle-btn]').click()

      cy.get('[data-cy=clear-completed]').click()
      cy.get('[data-cy=todo-text]').should('contain', textoActiva)
      cy.get('[data-cy=todo-item]').each(($el) => {
        cy.wrap($el).should('have.attr', 'data-completed', 'false')
      })
    })
  })
})
