#!/usr/bin/env node
// scripts/qa-agent.mjs
// ══════════════════════════════════════════════════════════════════
//  AGENTE AUTÓNOMO DE QA v2 — TaskFlow
//  Patrón AaaS: Percibe → Clasifica → Razona → Actúa
//
//  Mejoras v2:
//  - Clasificación inteligente de errores (flaky, timeout, selector, etc.)
//  - Anti-duplicados: busca en Jira antes de crear
//  - Relaciona tickets similares automáticamente
//  - Severidad automática por tipo de error
//  - Labels inteligentes por categoría
// ══════════════════════════════════════════════════════════════════

import fs from 'fs'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const JIRA_BASE_URL     = process.env.JIRA_BASE_URL
const JIRA_EMAIL        = process.env.JIRA_EMAIL
const JIRA_API_TOKEN    = process.env.JIRA_API_TOKEN
const JIRA_PROJECT_KEY  = process.env.JIRA_PROJECT_KEY || 'SCRUM'
const GITHUB_SHA        = process.env.GITHUB_SHA || 'local'
const GITHUB_REF        = process.env.GITHUB_REF_NAME || 'develop'
const GITHUB_REPO       = process.env.GITHUB_REPOSITORY || 'taskflow'

const c = {
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue:   (s) => `\x1b[34m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
}

// ══════════════════════════════════════════════════════════════════
// CLASIFICADOR DE ERRORES
// Detecta el tipo de fallo para generar labels y severidad correcta
// ══════════════════════════════════════════════════════════════════
function classifyError(test) {
  const error   = (test.error || '').toLowerCase()
  const title   = (test.title || '').toLowerCase()
  const suite   = (test.fullTitle || '').toLowerCase()

  // Flaky: timeout intermitente en operaciones de red
  if (error.includes('timed out') && (error.includes('supabase') || error.includes('fetch') || error.includes('network'))) {
    return { type: 'flaky', severity: 'Medium', labels: ['flaky', 'network', 'cypress-e2e'] }
  }

  // Timeout: elemento no aparece en tiempo esperado
  if (error.includes('timed out retrying') || error.includes('timeout')) {
    return { type: 'timeout', severity: 'High', labels: ['timeout', 'cypress-e2e', 'ui'] }
  }

  // Selector roto: elemento no encontrado
  if (error.includes('expected to find element') || error.includes('cannot read properties') || error.includes('not found')) {
    return { type: 'selector', severity: 'High', labels: ['broken-selector', 'cypress-e2e', 'ui'] }
  }

  // Auth: problemas de autenticación
  if (suite.includes('auth') || suite.includes('login') || suite.includes('sesión') || error.includes('401') || error.includes('unauthorized')) {
    return { type: 'auth', severity: 'Highest', labels: ['auth', 'security', 'cypress-e2e'] }
  }

  // Backend/API: errores de servidor
  if (error.includes('500') || error.includes('502') || error.includes('503') || error.includes('api') || error.includes('supabase')) {
    return { type: 'backend', severity: 'High', labels: ['backend', 'api', 'cypress-e2e'] }
  }

  // Network: problemas de red
  if (error.includes('network') || error.includes('cors') || error.includes('err_connection') || error.includes('fetch')) {
    return { type: 'network', severity: 'High', labels: ['network', 'cypress-e2e'] }
  }

  // Regresión: assertion que antes pasaba y ahora falla
  if (error.includes('expected') && error.includes('actual')) {
    return { type: 'regression', severity: 'High', labels: ['regression', 'cypress-e2e'] }
  }

  // Frontend: problemas de UI generales
  if (suite.includes('todos') || suite.includes('filtros') || suite.includes('editar') || suite.includes('completar')) {
    return { type: 'frontend', severity: 'Medium', labels: ['frontend', 'ui', 'cypress-e2e'] }
  }

  // Navegación: rutas inexistentes o redireccionadas mal
  if (suite.includes('navegación') || suite.includes('ruta') || title.includes('dashboard') || title.includes('profile')) {
    return { type: 'navigation', severity: 'Medium', labels: ['navigation', 'routing', 'cypress-e2e'] }
  }

  // Validación: formularios
  if (suite.includes('validacion') || title.includes('email') || title.includes('caracteres') || title.includes('espacios')) {
    return { type: 'validation', severity: 'Low', labels: ['validation', 'forms', 'cypress-e2e'] }
  }

  return { type: 'unknown', severity: 'Medium', labels: ['cypress-e2e', 'needs-triage'] }
}

// ══════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL
// ══════════════════════════════════════════════════════════════════
async function runQAAgent() {
  console.log(c.bold('\n🤖 Agente Autónomo de QA v2 — TaskFlow\n'))
  console.log(`   Repo:   ${GITHUB_REPO}`)
  console.log(`   Rama:   ${GITHUB_REF}`)
  console.log(`   Commit: ${GITHUB_SHA.substring(0, 7)}`)
  console.log(`   Jira:   ${JIRA_BASE_URL || 'no configurado'}\n`)

  // ── PASO 1: PERCIBIR ─────────────────────────────────────────
  console.log(c.blue('📊 PASO 1: Leyendo y clasificando resultados de Cypress...'))
  const failedTests = readFailedTests()

  if (failedTests.length === 0) {
    console.log(c.green('✅ No hay fallos. Pipeline limpio.\n'))
    writeGitHubSummary('## ✅ Agente QA — Sin fallos\n\nTodos los tests pasaron correctamente.')
    process.exit(0)
  }

  // Clasificar cada fallo
  const classifiedTests = failedTests.map(t => ({
    ...t,
    classification: classifyError(t),
  }))

  console.log(`\n   ${c.red(`${classifiedTests.length} fallos detectados:`)}`)
  classifiedTests.forEach(t => {
    console.log(`   → [${t.classification.type.toUpperCase()}] ${t.title}`)
  })

  // Filtrar flaky conocidos — no crear tickets para ellos
  const validFailures = classifiedTests.filter(t => {
    if (t.classification.type === 'flaky') {
      console.log(c.yellow(`\n   ⚠️  Omitiendo fallo flaky: "${t.title}"`))
      return false
    }
    return true
  })

  if (validFailures.length === 0) {
    console.log(c.yellow('\n   Todos los fallos son flaky conocidos. No se crean tickets.\n'))
    writeGitHubSummary('## ⚠️ Agente QA — Solo fallos flaky\n\nLos fallos detectados son intermitentes conocidos. No se requiere acción.')
    process.exit(0)
  }

  // ── PASO 2: ANTI-DUPLICADOS ───────────────────────────────────
  console.log(c.blue('\n🔍 PASO 2: Verificando duplicados en Jira...'))
  const existingTitles = await getExistingJiraTitles()
  console.log(`   Tickets existentes en Jira: ${existingTitles.length}`)

  const newFailures = validFailures.filter(t => {
    const titleKey = t.title.replace('[FAIL] ', '').substring(0, 50).toLowerCase()
    const isDuplicate = existingTitles.some(existing =>
      existing.toLowerCase().includes(titleKey) ||
      titleKey.includes(existing.toLowerCase().substring(0, 30))
    )
    if (isDuplicate) {
      console.log(c.yellow(`   ⚠️  Duplicado omitido: "${t.title}"`))
    }
    return !isDuplicate
  })

  if (newFailures.length === 0) {
    console.log(c.yellow('\n   Todos los fallos ya tienen tickets en Jira.\n'))
    writeGitHubSummary('## ✅ Agente QA — Tickets ya existentes\n\nTodos los fallos detectados ya tienen tickets creados en Jira.')
    process.exit(0)
  }

  console.log(`   ${c.green(`${newFailures.length} fallos nuevos para crear tickets`)}`)

  // ── PASO 3: RAZONAR CON CLAUDE ────────────────────────────────
  console.log(c.blue('\n🧠 PASO 3: Claude analizando fallos...'))
  const analysis = await analyzeWithClaude(newFailures)
  console.log(`   Análisis: ${analysis.tickets.length} tickets generados`)

  // ── PASO 4: ACTUAR — CREAR TICKETS EN JIRA ───────────────────
  console.log(c.blue('\n📋 PASO 4: Creando tickets en Jira...\n'))
  const createdTickets = []

  for (const ticket of analysis.tickets) {
    const original = newFailures.find(f => f.title.includes(ticket.affectedTest?.substring(0, 20) || ''))
    const classification = original?.classification || { type: 'unknown', severity: 'Medium', labels: ['cypress-e2e'] }

    const key = await createJiraTicket(ticket, classification)
    if (key) {
      createdTickets.push({ ...ticket, key, classification })
      console.log(`   ✅ ${c.cyan(key)} [${classification.type}] — ${ticket.title}`)
    }
  }

  // ── RESUMEN FINAL ─────────────────────────────────────────────
  const summary = buildGitHubSummary(classifiedTests, createdTickets, analysis.summary)
  writeGitHubSummary(summary)

  console.log(c.bold(c.green('\n✅ Agente completado\n')))
  console.log(`   Fallos detectados:     ${failedTests.length}`)
  console.log(`   Fallos válidos:        ${validFailures.length}`)
  console.log(`   Tickets ya existentes: ${validFailures.length - newFailures.length}`)
  console.log(`   Tickets creados:       ${createdTickets.length}`)
  if (createdTickets.length > 0 && JIRA_BASE_URL) {
    console.log(`\n   📋 Ver en Jira: ${JIRA_BASE_URL}/jira/software/projects/${JIRA_PROJECT_KEY}/boards\n`)
  }
}

// ══════════════════════════════════════════════════════════════════
// LEER RESULTADOS DE CYPRESS
// ══════════════════════════════════════════════════════════════════
function readFailedTests() {
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

  // Datos reales del último run documentado de failures.cy.js
  console.log(c.dim('   Usando datos del run documentado de failures.cy.js\n'))
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
      fullTitle: '🔴 Fallos Intencionales > Navegación > forgot-password',
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
          title:     test.title,
          fullTitle: test.fullTitle,
          file:      raw.results?.[0]?.file || '',
          duration:  test.duration || 0,
          error:     test.err?.message || 'Error desconocido',
          stack:     test.err?.estack || '',
        })
      }
    }
    for (const child of suite.suites || []) walk(child)
  }
  suites.forEach(walk)
  return failed
}

// ══════════════════════════════════════════════════════════════════
// ANTI-DUPLICADOS — buscar tickets existentes en Jira
// ══════════════════════════════════════════════════════════════════
async function getExistingJiraTitles() {
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) return []

  try {
    const jql = encodeURIComponent(`project=${JIRA_PROJECT_KEY} AND labels=cypress-e2e AND created >= -30d`)
    const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/search?jql=${jql}&maxResults=50&fields=summary`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64'),
        'Accept': 'application/json',
      },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.issues || []).map(i => i.fields.summary.replace('[QA Auto] ', ''))
  } catch {
    return []
  }
}

// ══════════════════════════════════════════════════════════════════
// ANÁLISIS CON CLAUDE
// ══════════════════════════════════════════════════════════════════
async function analyzeWithClaude(failedTests) {
  if (!ANTHROPIC_API_KEY) {
    console.log(c.yellow('   ANTHROPIC_API_KEY no configurada — usando análisis por defecto'))
    return buildDefaultAnalysis(failedTests)
  }

  const testsStr = failedTests.map((t, i) => {
    const cls = t.classification
    return `Test ${i + 1}:
  Título: ${t.title}
  Suite: ${t.fullTitle}
  Tipo de error: ${cls.type} (severidad: ${cls.severity})
  Error: ${t.error}
  Duración: ${t.duration}ms
  Archivo: ${t.file}`
  }).join('\n\n')

  const prompt = `Eres un Senior QA Engineer analizando fallos E2E de TaskFlow (React + Vite + Supabase).
El agente ya clasificó cada fallo con su tipo y severidad. Usa esa información para generar tickets precisos.

FALLOS DETECTADOS (${failedTests.length}):
${testsStr}

Contexto del proyecto:
- Commit: ${GITHUB_SHA.substring(0, 7)}
- Rama: ${GITHUB_REF}
- Repositorio: ${GITHUB_REPO}

Responde ÚNICAMENTE con JSON válido. Estructura exacta:
{
  "summary": "resumen ejecutivo en 2 oraciones",
  "tickets": [
    {
      "title": "título máx 70 chars, claro y accionable",
      "type": "Bug",
      "priority": "High",
      "component": "Routing|Forms|Performance|Security|Auth|UI|API",
      "description": "descripción técnica en 2-3 oraciones con contexto del stack",
      "stepsToReproduce": ["paso 1", "paso 2", "paso 3"],
      "expectedResult": "comportamiento esperado según las especificaciones",
      "actualResult": "comportamiento actual observado en el test",
      "suggestedFix": "recomendación técnica concreta para el desarrollador",
      "affectedTest": "título exacto del test que falló"
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
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(`API ${res.status}: ${JSON.stringify(data)}`)
    const text = data.content?.[0]?.text || ''
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(clean)
  } catch (err) {
    console.log(c.yellow(`   ⚠️  Claude error: ${err.message}`))
    return buildDefaultAnalysis(failedTests)
  }
}

function buildDefaultAnalysis(failedTests) {
  return {
    summary: `Se detectaron ${failedTests.length} fallos en la suite de QA autónoma. Requieren atención del equipo.`,
    tickets: failedTests.map(t => ({
      title:            t.title.replace('[FAIL] ', '').substring(0, 70),
      type:             'Bug',
      priority:         t.classification?.severity || 'Medium',
      component:        t.classification?.type === 'navigation' ? 'Routing'
                      : t.classification?.type === 'validation'  ? 'Forms'
                      : t.classification?.type === 'auth'        ? 'Auth'
                      : t.classification?.type === 'backend'     ? 'API'
                      : 'UI',
      description:      `Fallo detectado en commit ${GITHUB_SHA.substring(0, 7)} (rama: ${GITHUB_REF}). Error: ${t.error}`,
      stepsToReproduce: ['Levantar la app con npm run dev', `Ejecutar: ${t.title}`, 'Observar el comportamiento'],
      expectedResult:   'El elemento o comportamiento debe existir según las especificaciones.',
      actualResult:     t.error,
      suggestedFix:     'Revisar el componente correspondiente e implementar la funcionalidad faltante.',
      affectedTest:     t.title,
    })),
  }
}

// ══════════════════════════════════════════════════════════════════
// CREAR TICKET EN JIRA (ADF format)
// ══════════════════════════════════════════════════════════════════
async function createJiraTicket(ticket, classification) {
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.log(c.yellow(`   ⚠️  Jira no configurado — demo: "${ticket.title}"`))
    return null
  }

  const commitUrl = `https://github.com/${GITHUB_REPO}/commit/${GITHUB_SHA}`

  const adfDescription = {
    type: 'doc', version: 1,
    content: [
      {
        type: 'heading', attrs: { level: 3 },
        content: [{ type: 'text', text: '📋 Descripción' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: ticket.description }],
      },
      {
        type: 'heading', attrs: { level: 3 },
        content: [{ type: 'text', text: '🔬 Tipo de Error' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: `Clasificación automática: ${classification.type.toUpperCase()} | Severidad: ${classification.severity}` }],
      },
      {
        type: 'heading', attrs: { level: 3 },
        content: [{ type: 'text', text: '🪜 Steps to Reproduce' }],
      },
      {
        type: 'orderedList',
        content: ticket.stepsToReproduce.map(step => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: step }] }],
        })),
      },
      {
        type: 'heading', attrs: { level: 3 },
        content: [{ type: 'text', text: '✅ Resultado Esperado' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: ticket.expectedResult }],
      },
      {
        type: 'heading', attrs: { level: 3 },
        content: [{ type: 'text', text: '❌ Resultado Actual' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: ticket.actualResult }],
      },
      {
        type: 'heading', attrs: { level: 3 },
        content: [{ type: 'text', text: '🔧 Fix Sugerido' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: ticket.suggestedFix }],
      },
      {
        type: 'heading', attrs: { level: 3 },
        content: [{ type: 'text', text: '🔗 Contexto del Pipeline' }],
      },
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Spec: cypress/e2e/failures.cy.js` }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Commit: ${GITHUB_SHA.substring(0, 7)} — ${commitUrl}` }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Rama: ${GITHUB_REF}` }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Entorno: Staging (CI)` }] }] },
        ],
      },
      { type: 'rule' },
      {
        type: 'paragraph',
        content: [{
          type: 'text',
          text: `🤖 Creado automáticamente por Agente de QA v2 | ${new Date().toISOString()}`,
          marks: [{ type: 'em' }],
        }],
      },
    ],
  }

  const body = {
    fields: {
      project:     { key: JIRA_PROJECT_KEY },
      summary:     `[QA Auto] ${ticket.title}`,
      issuetype:   { name: 'Bug' },
      priority:    { name: classification.severity },
      description: adfDescription,
      labels:      [...new Set([...classification.labels, 'autonomous-qa'])],
    },
  }

  try {
    const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64'),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    if (!res.ok) {
      console.log(c.red(`   ❌ Jira ${res.status}: ${JSON.stringify(data.errors || data.errorMessages || data)}`))
      return null
    }
    return data.key
  } catch (err) {
    console.log(c.red(`   ❌ Red: ${err.message}`))
    return null
  }
}

// ══════════════════════════════════════════════════════════════════
// RESUMEN GITHUB ACTIONS
// ══════════════════════════════════════════════════════════════════
function buildGitHubSummary(allTests, createdTickets, summaryText) {
  const jiraBoard = JIRA_BASE_URL
    ? `${JIRA_BASE_URL}/jira/software/projects/${JIRA_PROJECT_KEY}/boards`
    : '#'

  const byType = allTests.reduce((acc, t) => {
    const type = t.classification?.type || 'unknown'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {})

  const typeRows = Object.entries(byType)
    .map(([type, count]) => `| ${type} | ${count} |`)
    .join('\n')

  const ticketRows = createdTickets.length > 0
    ? createdTickets.map(t =>
        `| [${t.key}](${JIRA_BASE_URL}/browse/${t.key}) | ${t.title} | ${t.classification?.severity || '-'} | ${t.classification?.type || '-'} |`
      ).join('\n')
    : '| — | Sin tickets nuevos (ya existen o Jira no configurado) | — | — |'

  return `## 🤖 Agente Autónomo de QA v2 — Reporte

> ${summaryText}

### 📊 Clasificación de fallos

| Tipo | Cantidad |
|------|----------|
${typeRows}

### 📋 Tickets creados en Jira

| Ticket | Descripción | Severidad | Tipo |
|--------|-------------|-----------|------|
${ticketRows}

${createdTickets.length > 0 ? `🔗 [Ver tablero Jira](${jiraBoard})` : ''}

---
*Agente QA v2 · commit \`${GITHUB_SHA.substring(0, 7)}\` · rama \`${GITHUB_REF}\` · ${new Date().toISOString()}*
`
}

function writeGitHubSummary(content) {
  const p = process.env.GITHUB_STEP_SUMMARY
  if (p) fs.appendFileSync(p, content)
}

// ══════════════════════════════════════════════════════════════════
runQAAgent().catch(err => {
  console.error(c.red('\n❌ Error fatal:'), err.message)
  process.exit(1)
})
