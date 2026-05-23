// playwright.config.js
// Configuración de Playwright — mismo proyecto que Cypress
// Los tests viven en playwright/tests/ para no confundir con cypress/e2e/

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  // Directorio de tests de Playwright
  testDir: './playwright/tests',

  // Timeout por test (Cypress default es 4s por assertion, aquí es global)
  timeout: 30000,

  // Timeout para assertions (.toBeVisible(), etc.)
  expect: { timeout: 8000 },

  // Cuántas veces reintentar un test fallido en CI
  retries: process.env.CI ? 1 : 0,

  // Correr tests en paralelo (diferencia clave vs Cypress en plan free)
  workers: process.env.CI ? 2 : undefined,

  // Reporter: en CI genera JSON para el script de comparativa
  reporter: process.env.CI
    ? [['json', { outputFile: 'playwright-results.json' }], ['list']]
    : [['list']],

  use: {
    // URL base — igual que Cypress baseUrl
    baseURL: 'http://localhost:5173',

    // Capturar screenshot solo en fallos (igual que Cypress)
    screenshot: 'only-on-failure',

    // Video solo en CI
    video: process.env.CI ? 'retain-on-failure' : 'off',

    // Tracing para debugging (equivalente al Test Replay de Cypress Cloud)
    trace: process.env.CI ? 'retain-on-failure' : 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Playwright puede correr en múltiples navegadores fácilmente
    // (ventaja sobre Cypress que requiere plan de pago para multi-browser en CI)
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  // NO levanta el servidor automáticamente — GitHub Actions lo hace antes
  // Para local: corre `npm run dev` en otra terminal
})
