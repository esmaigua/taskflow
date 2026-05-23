#!/usr/bin/env node
// scripts/qa-agent.mjs
//
// ══════════════════════════════════════════════════════════════════
//  AGENTE AUTÓNOMO DE QA — Autonomous QA Agent
// ══════════════════════════════════════════════════════════════════
//
// Qué hace este agente:
//  1. Lee el reporte JSON de resultados de Cypress
//  2. Llama a Claude (vía API) para analizar los fallos
//  3. Claude genera tickets profesionales para cada fallo
//  4. El agente los crea en Jira vía REST API
//  5. Publica un resumen en el PR de GitHub
//
// Cómo encaja en el concepto AaaS:
//  - PERCIBE: lee resultados de Cypress (contexto del entorno)
//  - RAZONA: Claude analiza qué falló y por qué importa
//  - ACTÚA: crea tickets, comenta en PRs, notifica
// ══════════════════════════════════════════════════════════════════

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

// ── Configuración ────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const JIRA_BASE_URL     = process.env.JIRA_BASE_URL       // ej: https://tuempresa.atlassian.net
const JIRA_EMAIL        = process.env.JIRA_EMAIL          // tu email de Jira
const JIRA_API_TOKEN    = process.env.JIRA_API_TOKEN      // token de Jira Cloud
const JIRA_PROJECT_KEY  = process.env.JIRA_PROJECT_KEY || 'TF'  // clave del proyecto Jira
const GITHUB_TOKEN      = process.env.GITHUB_TOKEN
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY   // owner/repo
const GITHUB_SHA        = process.env.GITHUB_SHA

// ── Colores para la terminal ─────────────────────────────────────
const c = {
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue:   (s) => `\x1b[34m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
}

// ── Función principal ────────────────────────────────────────────
async function runQAAgent() {
  console.log(c.bold('\n🤖 Agente Autónomo de QA — Iniciando...\n'))

  // 1. PERCIBIR — Leer resultados de Cypress
  console.log(c.blue('📊 PASO 1: Leyendo resultados de Cypress...'))
  const cypressResults = readCypressResults()

  if (!cypressResults || cypressResults.length === 0) {
    console.log(c.yellow('⚠️  No se encontraron resultados. ¿Corrió la suite de failures?'))
    process.exit(0)
  }

  const failedTests = cypressResults.filter(t => t.status === 'failed')
  const passedTests = cypressResults.filter(t => t.status === 'passed')

  console.log(`   ✅ Tests pasados: ${c.green(passedTests.length)}`)
  console.log(`   ❌ Tests fallidos: ${c.red(failedTests.length)}`)

  if (failedTests.length === 0) {
    console.log(c.green('\n✅ No hay fallos que reportar. Pipeline limpio.\n'))
    await notifyGitHubSuccess(passedTests.length)
    process.exit(0)
  }

  // 2. RAZONAR — Claude analiza los fallos
  console.log(c.blue('\n🧠 PASO 2: Claude analizando los fallos...\n'))
  const analysis = await analyzeWithClaude(failedTests)

  // 3. ACTUAR — Crear tickets en Jira
  console.log(c.blue('\n📋 PASO 3: Creando tickets en Jira...\n'))
  const createdTickets = []

  for (const ticket of analysis.tickets) {
    const jiraKey = await createJiraTicket(ticket)
    if (jiraKey) {
      createdTickets.push({ ...ticket, jiraKey })
      console.log(`   ✅ Creado: ${c.cyan(jiraKey)} — ${ticket.title}`)
    }
  }

  // 4. NOTIFICAR — Comentar en el PR de GitHub
  console.log(c.blue('\n💬 PASO 4: Publicando resumen en GitHub...\n'))
  await notifyGitHubFailures(failedTests, createdTickets, analysis.summary)

  console.log(c.bold(c.green('\n✅ Agente autónomo completado exitosamente\n')))
  console.log(`   Tickets creados: ${createdTickets.length}`)
  console.log(`   Fallos detectados: ${failedTests.length}`)
}

// ── Leer resultados de Cypress ────────────────────────────────────
function readCypressResults() {
  // Cypress puede generar un reporte JSON con el plugin mochawesome
  // Si no existe el JSON, parseamos del output estándar
  const possiblePaths = [
    'cypress/results/output.json',
    'cypress-results.json',
    'results/cypress-results.json',
  ]

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`   Encontrado: ${p}`)
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'))
      return parseMochawesomeResults(raw)
    }
  }

  // Si no hay JSON, construimos resultados desde las variables de entorno
  // (en producción real usarías el plugin mochawesome-reporter)
  console.log(c.yellow('   ⚠️  No se encontró JSON de resultados. Usando datos de demo.'))
  return getDemoResults()
}

function parseMochawesomeResults(raw) {
  const tests = []
  const suites = raw.results?.[0]?.suites || []

  function extractTests(suite) {
    for (const test of suite.tests || []) {
      tests.push({
        title: test.title,
        fullTitle: test.fullTitle,
        status: test.pass ? 'passed' : test.fail ? 'failed' : 'pending',
        duration: test.duration,
        error: test.err?.message || null,
        errorStack: test.err?.estack || null,
        file: raw.results?.[0]?.file || 'unknown',
      })
    }
    for (const child of suite.suites || []) {
      extractTests(child)
    }
  }

  suites.forEach(extractTests)
  return tests
}

// Resultados de demo para cuando no hay JSON real
function getDemoResults() {
  return [
    {
      title: '[FAIL] Ruta /dashboard no existe — debe retornar 404',
      fullTitle: 'Fallos Intencionales > Navegación > [FAIL] Ruta /dashboard',
      status: 'failed',
      duration: 4012,
      error: 'Timed out retrying after 4000ms: Expected to find element: [data-cy=dashboard-title], but never found it.',
      errorStack: 'AssertionError: Timed out retrying...\n    at cypress/e2e/failures.cy.js:28:8',
      file: 'cypress/e2e/failures.cy.js',
    },
    {
      title: '[FAIL] Enlace "¿Olvidaste tu contraseña?" debe existir en login',
      fullTitle: 'Fallos Intencionales > Navegación > [FAIL] Enlace forgot-password',
      status: 'failed',
      duration: 3008,
      error: 'Timed out retrying after 4000ms: Expected to find element: [data-cy=forgot-password-link]',
      errorStack: 'AssertionError: Timed out retrying...\n    at cypress/e2e/failures.cy.js:42:8',
      file: 'cypress/e2e/failures.cy.js',
    },
    {
      title: '[FAIL] La app debe cargar en menos de 1500ms',
      fullTitle: 'Fallos Intencionales > Rendimiento > [FAIL] Performance',
      status: 'failed',
      duration: 2341,
      error: 'AssertionError: expected 2341 to be below 1500',
      errorStack: 'AssertionError: expected 2341...\n    at cypress/e2e/failures.cy.js:89:32',
      file: 'cypress/e2e/failures.cy.js',
    },
    {
      title: '[FAIL] Email con formato inválido debe mostrar error inmediato',
      fullTitle: 'Fallos Intencionales > Validaciones > [FAIL] Email validation',
      status: 'failed',
      duration: 3100,
      error: 'Timed out retrying: Expected to find element: [data-cy=inline-email-error]',
      errorStack: 'AssertionError: Timed out...\n    at cypress/e2e/failures.cy.js:67:8',
      file: 'cypress/e2e/failures.cy.js',
    },
  ]
}

// ── Claude analiza los fallos y genera tickets ────────────────────
async function analyzeWithClaude(failedTests) {
  if (!ANTHROPIC_API_KEY) {
    console.log(c.yellow('   ⚠️  ANTHROPIC_API_KEY no configurada. Usando análisis de demo.'))
    return getDemoAnalysis(failedTests)
  }

  const prompt = buildAnalysisPrompt(failedTests)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: `Eres un Senior QA Engineer y Automation Architect.
Tu tarea es analizar fallos de tests de Cypress E2E y generar tickets de Jira profesionales.
Debes responder ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin explicaciones.
El JSON debe tener exactamente esta estructura:
{
  "summary": "resumen ejecutivo de los fallos en 2-3 oraciones",
  "tickets": [
    {
      "title": "título profesional del ticket (máx 80 chars)",
      "type": "Bug|Story|Task",
      "priority": "Highest|High|Medium|Low",
      "component": "nombre del módulo afectado",
      "description": "descripción detallada en markdown",
      "stepsToReproduce": ["paso 1", "paso 2", "paso 3"],
      "expectedResult": "qué debería pasar",
      "actualResult": "qué está pasando actualmente",
      "suggestedFix": "recomendación técnica del fix",
      "affectedTest": "título del test que falló"
    }
  ]
}`,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    // Limpiar posibles backticks de markdown
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(clean)

  } catch (err) {
    console.log(c.yellow(`   ⚠️  Error llamando a Claude: ${err.message}. Usando análisis de demo.`))
    return getDemoAnalysis(failedTests)
  }
}

function buildAnalysisPrompt(failedTests) {
  const testsStr = failedTests.map((t, i) => `
Test ${i + 1}:
  Título: ${t.title}
  Suite completa: ${t.fullTitle}
  Archivo: ${t.file}
  Duración: ${t.duration}ms
  Error: ${t.error}
  Stack: ${t.errorStack}
`).join('\n---\n')

  return `Analiza estos ${failedTests.length} fallos de tests E2E de la aplicación TaskFlow 
(React + Vite + Supabase). Es una app de gestión de tareas con autenticación.

FALLOS DETECTADOS:
${testsStr}

Genera un ticket de Jira profesional para cada fallo.
Recuerda: responde SOLO con JSON válido.`
}

// Análisis de demo cuando no hay API key
function getDemoAnalysis(failedTests) {
  return {
    summary: `Se detectaron ${failedTests.length} fallos en la suite de QA autónoma. Los principales problemas son: rutas inexistentes (/dashboard, /profile), falta de flujo de recuperación de contraseña, y validaciones de formulario incompletas. Se requiere atención en navegación y UX.`,
    tickets: failedTests.map((t, i) => ({
      title: t.title.replace('[FAIL] ', '').substring(0, 80),
      type: t.title.includes('performance') || t.title.includes('cargar') ? 'Story' : 'Bug',
      priority: i === 0 ? 'High' : i === 1 ? 'High' : 'Medium',
      component: t.fullTitle.includes('Navegación') ? 'Routing'
               : t.fullTitle.includes('Validacion') ? 'Forms'
               : t.fullTitle.includes('Rendimiento') ? 'Performance'
               : 'Security',
      description: `## Descripción\n\nSe detectó un fallo en la suite de tests E2E durante el pipeline de CI/CD.\n\n**Test fallido:** \`${t.title}\`\n\n**Error:** \`${t.error}\`\n\n## Contexto\n\nEste fallo fue detectado automáticamente por el Agente Autónomo de QA en el commit \`${GITHUB_SHA?.substring(0, 7) || 'local'}\`.`,
      stepsToReproduce: [
        'Levantar la aplicación localmente con npm run dev',
        `Navegar a la ruta o realizar la acción que activa el test: "${t.title}"`,
        'Observar el comportamiento actual vs el esperado',
      ],
      expectedResult: 'El elemento o comportamiento debe existir según las especificaciones de la aplicación.',
      actualResult: t.error,
      suggestedFix: 'Revisar el componente correspondiente e implementar la funcionalidad faltante o corregir la validación.',
      affectedTest: t.title,
    })),
  }
}

// ── Crear ticket en Jira ──────────────────────────────────────────
async function createJiraTicket(ticket) {
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.log(c.yellow(`   ⚠️  Jira no configurado. Ticket que se crearía: "${ticket.title}"`))
    return `${JIRA_PROJECT_KEY}-DEMO-${Math.floor(Math.random() * 1000)}`
  }

  const priorityMap = {
    'Highest': 'Highest',
    'High': 'High',
    'Medium': 'Medium',
    'Low': 'Low',
  }

  const body = {
    fields: {
      project: { key: JIRA_PROJECT_KEY },
      summary: `[QA Auto] ${ticket.title}`,
      issuetype: { name: ticket.type === 'Bug' ? 'Bug' : 'Story' },
      priority: { name: priorityMap[ticket.priority] || 'Medium' },
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: ticket.description }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: `\n\n**Steps to Reproduce:**\n${ticket.stepsToReproduce.map((s, i) => `${i+1}. ${s}`).join('\n')}` }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: `\n**Expected:** ${ticket.expectedResult}\n**Actual:** ${ticket.actualResult}\n**Suggested Fix:** ${ticket.suggestedFix}` }],
          },
        ],
      },
      labels: ['autonomous-qa', 'cypress-e2e', ticket.component.toLowerCase()],
    },
  }

  try {
    const credentials = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      console.log(c.red(`   ❌ Error creando ticket en Jira: ${response.status} — ${error}`))
      return null
    }

    const data = await response.json()
    return data.key

  } catch (err) {
    console.log(c.red(`   ❌ Error de red con Jira: ${err.message}`))
    return null
  }
}

// ── Notificar a GitHub ────────────────────────────────────────────
async function notifyGitHubFailures(failedTests, tickets, summary) {
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) {
    console.log(c.yellow('   ⚠️  GitHub token no configurado. El resumen sería:'))
    printSummaryToConsole(failedTests, tickets, summary)
    return
  }

  const body = buildGitHubComment(failedTests, tickets, summary)

  // Escribir como step summary de GitHub Actions
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (summaryPath) {
    fs.appendFileSync(summaryPath, body)
    console.log('   ✅ Resumen escrito en GitHub Actions Summary')
  }
}

async function notifyGitHubSuccess(passedCount) {
  const body = `## ✅ Suite de QA Autónoma — Sin fallos\n\n${passedCount} tests pasaron correctamente. No se requiere acción.\n`
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (summaryPath) fs.appendFileSync(summaryPath, body)
}

function buildGitHubComment(failedTests, tickets, summary) {
  const ticketList = tickets.map(t =>
    `| \`${t.jiraKey}\` | ${t.title} | ${t.priority} | ${t.component} |`
  ).join('\n')

  return `## 🤖 Agente Autónomo de QA — Reporte

${summary}

### ❌ Tests fallidos (${failedTests.length})

${failedTests.map(t => `- **${t.title}**\n  - Error: \`${t.error?.substring(0, 100)}...\``).join('\n')}

### 📋 Tickets creados en Jira

| Ticket | Descripción | Prioridad | Componente |
|--------|-------------|-----------|------------|
${ticketList || '| — | No se pudieron crear tickets (Jira no configurado) | — | — |'}

### 📊 Próximos pasos

1. Revisar los tickets creados en Jira
2. Asignar responsables por componente
3. Priorizar según sprint actual
4. Ejecutar \`npm run cypress:open\` localmente para reproducir los fallos

---
*Generado automáticamente por el Agente Autónomo de QA · ${new Date().toISOString()}*
`
}

function printSummaryToConsole(failedTests, tickets, summary) {
  console.log('\n' + '─'.repeat(60))
  console.log(c.bold('📋 RESUMEN DEL AGENTE AUTÓNOMO'))
  console.log('─'.repeat(60))
  console.log('\n' + summary + '\n')
  console.log(c.bold('Tickets que se crearían en Jira:'))
  tickets.forEach(t => {
    console.log(`\n  ${c.cyan(t.title)}`)
    console.log(`  Tipo: ${t.type} | Prioridad: ${t.priority} | Componente: ${t.component}`)
    console.log(`  Fix sugerido: ${t.suggestedFix}`)
  })
  console.log('\n' + '─'.repeat(60) + '\n')
}

// ── Arrancar ─────────────────────────────────────────────────────
runQAAgent().catch(err => {
  console.error(c.red('\n❌ Error fatal en el agente:'), err)
  process.exit(1)
})
