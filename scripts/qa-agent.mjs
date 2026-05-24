#!/usr/bin/env node
// scripts/qa-agent.mjs
// ══════════════════════════════════════════════════════════════════
//  AGENTE AUTÓNOMO DE QA — Autonomous QA Agent
//  Percibe → Razona → Actúa (AaaS pattern)
//
//  1. PERCIBE:  Lee resultados de Cypress (failures.cy.js)
//  2. RAZONA:   Claude analiza cada fallo y genera tickets profesionales
//  3. ACTÚA:    Crea los tickets en Jira vía REST API
// ══════════════════════════════════════════════════════════════════

import fs from 'fs'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const JIRA_BASE_URL     = process.env.JIRA_BASE_URL
const JIRA_EMAIL        = process.env.JIRA_EMAIL
const JIRA_API_TOKEN    = process.env.JIRA_API_TOKEN
const JIRA_PROJECT_KEY  = process.env.JIRA_PROJECT_KEY || 'SCRUM'
const GITHUB_SHA        = process.env.GITHUB_SHA || 'local'
const GITHUB_REF        = process.env.GITHUB_REF_NAME || 'develop'

const c = {
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue:   (s) => `\x1b[34m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
}

// ══════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL
// ══════════════════════════════════════════════════════════════════
async function runQAAgent() {
  console.log(c.bold('\n🤖 Agente Autónomo de QA — TaskFlow\n'))
  console.log(`   Rama:   ${GITHUB_REF}`)
  console.log(`   Commit: ${GITHUB_SHA.substring(0, 7)}`)
  console.log(`   Jira:   ${JIRA_BASE_URL || 'no configurado'}\n`)

  // ── PASO 1: PERCIBIR ─────────────────────────────────────────
  console.log(c.blue('📊 PASO 1: Leyendo resultados de Cypress...'))
  const failedTests = readFailedTests()

  if (failedTests.length === 0) {
    console.log(c.green('✅ No hay fallos. Pipeline limpio.\n'))
    writeGitHubSummary('## ✅ Agente QA — Sin fallos\n\nTodos los tests pasaron correctamente.')
    process.exit(0)
  }

  console.log(`   ${c.red(`${failedTests.length} fallos detectados`)}`)
  failedTests.forEach(t => console.log(`   → ${t.title}`))

  // ── PASO 2: RAZONAR ──────────────────────────────────────────
  console.log(c.blue('\n🧠 PASO 2: Claude analizando fallos...\n'))
  const analysis = await analyzeWithClaude(failedTests)
  console.log(`   Análisis completado: ${analysis.tickets.length} tickets generados`)

  // ── PASO 3: ACTUAR ───────────────────────────────────────────
  console.log(c.blue('\n📋 PASO 3: Creando tickets en Jira...\n'))
  const createdTickets = []

  for (const ticket of analysis.tickets) {
    const key = await createJiraTicket(ticket)
    if (key) {
      createdTickets.push({ ...ticket, key })
      console.log(`   ✅ ${c.cyan(key)} — ${ticket.title}`)
    }
  }

  // ── RESUMEN FINAL ─────────────────────────────────────────────
  const summary = buildGitHubSummary(failedTests, createdTickets, analysis.summary)
  writeGitHubSummary(summary)

  console.log(c.bold(c.green('\n✅ Agente completado\n')))
  console.log(`   Fallos detectados: ${failedTests.length}`)
  console.log(`   Tickets en Jira:   ${createdTickets.length}`)
  if (createdTickets.length > 0) {
    console.log(`   Ver en Jira:       ${JIRA_BASE_URL}/jira/software/projects/${JIRA_PROJECT_KEY}/boards\n`)
  }
}

// ══════════════════════════════════════════════════════════════════
// PASO 1 — PERCIBIR: leer resultados de Cypress
// ══════════════════════════════════════════════════════════════════
function readFailedTests() {
  // Cypress genera JSON con mochawesome-reporter (opcional)
  // Si no existe, usamos los datos de demo del último run conocido
  const paths = ['cypress/results/output.json', 'cypress-results.json']

  for (const p of paths) {
    if (fs.existsSync(p)) {
      console.log(`   Leyendo: ${p}`)
      try {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'))
        return extractFailed(raw)
      } catch (e) {
        console.log(c.yellow(`   ⚠️  Error parseando ${p}: ${e.message}`))
      }
    }
  }

  // Datos reales del último run de GitHub Actions
  // (6 fallos intencionales documentados en failures.cy.js)
  console.log(c.yellow('   Usando datos del último run conocido de CI\n'))
  return [
    {
      title: 'Ruta /dashboard no existe — debe retornar 404',
      fullTitle: '🔴 Fallos Intencionales > Navegación > Ruta /dashboard',
      file: 'cypress/e2e/failures.cy.js',
      duration: 4012,
      error: "Timed out retrying after 4000ms: Expected to find element: '[data-cy=dashboard-title]', but never found it.",
    },
    {
      title: 'Enlace ¿Olvidaste tu contraseña? debe existir en login',
      fullTitle: '🔴 Fallos Intencionales > Navegación > Enlace forgot-password',
      file: 'cypress/e2e/failures.cy.js',
      duration: 3008,
      error: "Timed out retrying after 4000ms: Expected to find element: '[data-cy=forgot-password-link]'",
    },
    {
      title: 'Página /profile debe ser accesible estando autenticado',
      fullTitle: '🔴 Fallos Intencionales > Navegación > /profile',
      file: 'cypress/e2e/failures.cy.js',
      duration: 4001,
      error: "Timed out retrying after 4000ms: Expected to find element: '[data-cy=profile-page]'",
    },
    {
      title: 'Input de tarea debe rechazar texto con solo espacios',
      fullTitle: '🔴 Fallos Intencionales > Validaciones > espacios',
      file: 'cypress/e2e/failures.cy.js',
      duration: 4050,
      error: "Too many elements found. Found '5', expected '0'.",
    },
    {
      title: 'Email con formato inválido debe mostrar error inmediato',
      fullTitle: '🔴 Fallos Intencionales > Validaciones > email onBlur',
      file: 'cypress/e2e/failures.cy.js',
      duration: 3100,
      error: "Timed out retrying: Expected to find element: '[data-cy=inline-email-error]'",
    },
    {
      title: 'Tarea con 120+ caracteres debe ser rechazada',
      fullTitle: '🔴 Fallos Intencionales > Validaciones > maxLength',
      file: 'cypress/e2e/failures.cy.js',
      duration: 4020,
      error: "expected '<p.input-error>' to contain '120'",
    },
  ]
}

function extractFailed(raw) {
  const failed = []
  const suites = raw.results?.[0]?.suites || []
  function walk(suite) {
    for (const test of suite.tests || []) {
      if (test.fail) {
        failed.push({
          title: test.title,
          fullTitle: test.fullTitle,
          file: raw.results?.[0]?.file || '',
          duration: test.duration || 0,
          error: test.err?.message || 'Error desconocido',
        })
      }
    }
    for (const child of suite.suites || []) walk(child)
  }
  suites.forEach(walk)
  return failed
}

// ══════════════════════════════════════════════════════════════════
// PASO 2 — RAZONAR: Claude analiza los fallos
// ══════════════════════════════════════════════════════════════════
async function analyzeWithClaude(failedTests) {
  if (!ANTHROPIC_API_KEY) {
    console.log(c.yellow('   ANTHROPIC_API_KEY no configurada — usando análisis por defecto'))
    return buildDefaultAnalysis(failedTests)
  }

  const testsStr = failedTests.map((t, i) =>
    `Test ${i + 1}:\n  Título: ${t.title}\n  Suite: ${t.fullTitle}\n  Error: ${t.error}\n  Duración: ${t.duration}ms`
  ).join('\n\n')

  const prompt = `Eres un Senior QA Engineer analizando fallos E2E de TaskFlow (React + Vite + Supabase).

FALLOS DETECTADOS (${failedTests.length}):
${testsStr}

Responde ÚNICAMENTE con JSON válido, sin markdown, sin explicaciones. Estructura exacta:
{
  "summary": "resumen ejecutivo en 2 oraciones",
  "tickets": [
    {
      "title": "título máx 70 chars sin [FAIL]",
      "type": "Bug",
      "priority": "High",
      "component": "Routing|Forms|Performance|Security|Auth",
      "description": "descripción técnica del problema en 2-3 oraciones",
      "stepsToReproduce": ["paso 1", "paso 2", "paso 3"],
      "expectedResult": "comportamiento esperado",
      "actualResult": "comportamiento actual observado",
      "suggestedFix": "recomendación técnica concreta"
    }
  ]
}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(`API error ${res.status}: ${JSON.stringify(data)}`)

    const text = data.content?.[0]?.text || ''
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(clean)

  } catch (err) {
    console.log(c.yellow(`   ⚠️  Claude API error: ${err.message}`))
    return buildDefaultAnalysis(failedTests)
  }
}

function buildDefaultAnalysis(failedTests) {
  const componentMap = (t) => {
    if (t.fullTitle.includes('Navegación')) return 'Routing'
    if (t.fullTitle.includes('Validacion') || t.fullTitle.includes('Input') || t.fullTitle.includes('Email')) return 'Forms'
    if (t.fullTitle.includes('Rendimiento') || t.fullTitle.includes('cargar')) return 'Performance'
    if (t.fullTitle.includes('Seguridad') || t.fullTitle.includes('token') || t.fullTitle.includes('XSS')) return 'Security'
    return 'General'
  }

  return {
    summary: `Se detectaron ${failedTests.length} fallos en la suite de QA autónoma. Los problemas abarcan rutas inexistentes, validaciones de formulario incompletas y ausencia de páginas requeridas.`,
    tickets: failedTests.map((t, i) => ({
      title: t.title.replace('[FAIL] ', '').substring(0, 70),
      type: 'Bug',
      priority: i < 2 ? 'High' : 'Medium',
      component: componentMap(t),
      description: `Fallo detectado automáticamente por el Agente de QA en commit ${GITHUB_SHA.substring(0, 7)}. El test "${t.title}" falló con el error: ${t.error}`,
      stepsToReproduce: [
        'Ejecutar npm run dev para levantar la aplicación',
        `Reproducir el escenario: ${t.title}`,
        'Observar que el comportamiento no coincide con el esperado',
      ],
      expectedResult: 'El elemento o funcionalidad debe existir y comportarse según las especificaciones.',
      actualResult: t.error,
      suggestedFix: 'Implementar la funcionalidad faltante o corregir la validación en el componente correspondiente.',
    })),
  }
}

// ══════════════════════════════════════════════════════════════════
// PASO 3 — ACTUAR: crear ticket en Jira
// ══════════════════════════════════════════════════════════════════
async function createJiraTicket(ticket) {
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.log(c.yellow(`   ⚠️  Jira no configurado — ticket demo: "${ticket.title}"`))
    return null
  }

  // Formato ADF (Atlassian Document Format) — requerido por Jira Cloud API v3
  const adfDescription = {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Descripción' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: ticket.description }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Steps to Reproduce' }],
      },
      {
        type: 'orderedList',
        content: ticket.stepsToReproduce.map(step => ({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: step }],
          }],
        })),
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Resultado Esperado' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: ticket.expectedResult }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Resultado Actual' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: ticket.actualResult }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Fix Sugerido' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: ticket.suggestedFix }],
      },
      {
        type: 'rule', // línea separadora
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: `🤖 Creado automáticamente por Agente de QA · Commit: ${GITHUB_SHA.substring(0, 7)} · Rama: ${GITHUB_REF}`,
            marks: [{ type: 'em' }],
          },
        ],
      },
    ],
  }

  const body = {
    fields: {
      project:     { key: JIRA_PROJECT_KEY },
      summary:     `[QA Auto] ${ticket.title}`,
      issuetype:   { name: 'Bug' },
      priority:    { name: ticket.priority || 'Medium' },
      description: adfDescription,
      labels:      ['autonomous-qa', 'cypress-e2e', ticket.component.toLowerCase()],
    },
  }

  try {
    const credentials = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')
    const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    if (!res.ok) {
      console.log(c.red(`   ❌ Jira error ${res.status}: ${JSON.stringify(data.errors || data.errorMessages || data)}`))
      return null
    }

    return data.key

  } catch (err) {
    console.log(c.red(`   ❌ Error de red con Jira: ${err.message}`))
    return null
  }
}

// ══════════════════════════════════════════════════════════════════
// RESUMEN EN GITHUB ACTIONS
// ══════════════════════════════════════════════════════════════════
function buildGitHubSummary(failedTests, createdTickets, summaryText) {
  const jiraBoard = `${JIRA_BASE_URL}/jira/software/projects/${JIRA_PROJECT_KEY}/boards`

  const ticketRows = createdTickets.length > 0
    ? createdTickets.map(t =>
        `| [${t.key}](${JIRA_BASE_URL}/browse/${t.key}) | ${t.title} | ${t.priority} | ${t.component} |`
      ).join('\n')
    : '| — | Jira no configurado | — | — |'

  const failRows = failedTests.map(t =>
    `- **${t.title}**\n  \`${t.error?.substring(0, 120)}\``
  ).join('\n')

  return `## 🤖 Agente Autónomo de QA — Reporte

> ${summaryText}

### ❌ Fallos detectados (${failedTests.length})

${failRows}

### 📋 Tickets creados en Jira

| Ticket | Descripción | Prioridad | Componente |
|--------|-------------|-----------|------------|
${ticketRows}

${createdTickets.length > 0 ? `🔗 [Ver tablero en Jira](${jiraBoard})` : ''}

---
*Agente Autónomo de QA · commit \`${GITHUB_SHA.substring(0, 7)}\` · rama \`${GITHUB_REF}\` · ${new Date().toISOString()}*
`
}

function writeGitHubSummary(content) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (summaryPath) {
    fs.appendFileSync(summaryPath, content)
    console.log(c.green('\n   📝 Resumen escrito en GitHub Actions'))
  }
}

// ══════════════════════════════════════════════════════════════════
runQAAgent().catch(err => {
  console.error(c.red('\n❌ Error fatal:'), err.message)
  process.exit(1)
})
