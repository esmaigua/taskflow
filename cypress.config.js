import { defineConfig } from 'cypress'

export default defineConfig({
  // ─── Cypress Cloud ────────────────────────────────────────────────────────
  // projectId se obtiene al crear el proyecto en cloud.cypress.io
  projectId: 'u8t5bf',

  e2e: {
    //baseUrl: 'http://localhost:5173',
    baseUrl: 'https://taskflow-sooty-pi.vercel.app',
    viewportWidth: 1280,
    viewportHeight: 720,
    // En CI se graba video; localmente no (más rápido)
    video: process.env.CI === 'true',
    screenshotOnRunFailure: true,

    env: {
      // Localmente usa estos valores por defecto.
      // En CI se sobreescriben con CYPRESS_TEST_EMAIL / CYPRESS_TEST_PASSWORD
      // (GitHub Actions secrets → variables de entorno con prefijo CYPRESS_)
      TEST_EMAIL: 'test@taskflow.com',
      TEST_PASSWORD: 'Test1234!',
    },

    setupNodeEvents(on, config) {
      // Permite sobreescribir env vars desde la línea de comandos o CI
      // Ejemplo: CYPRESS_TEST_EMAIL=otro@correo.com npx cypress run
      return config
    },
  },
})

