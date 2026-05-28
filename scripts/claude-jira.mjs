#!/usr/bin/env node
// scripts/claude-jira.mjs
// ══════════════════════════════════════════════════════════════════
//  CLAUDE QA LEAD — Chat interactivo con Jira + Cypress
//
//  Actúa como QA Lead / Tech Lead del proyecto TaskFlow.
//  Consulta Jira en tiempo real y responde preguntas como:
//  - "¿Qué tests están fallando más?"
//  - "¿Qué módulo tiene más bugs?"
//  - "Crea tareas basadas en los tests fallados"
//  - "¿Qué tickets creó el agente autónomo?"
//  - "Dame un resumen del estado del proyecto"
//
//  USO:
//    npm run qa:chat                          → modo interactivo
//    npm run qa:chat "tu pregunta aquí"      → pregunta directa
// ══════════════════════════════════════════════════════════════════

import fs   from 'fs'
import path from 'path'
import { createInterface } from 'readline'

// ── Cargar .env ───────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [key, ...rest] = trimmed.split('=')
    const value = rest.join('=').trim().replace(/^["']|["']$/g, '')
    if (key && value && !process.env[key]) process.env[key] = value
  }
}
loadEnv()

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const JIRA_BASE_URL     = process.env.JIRA_BASE_URL
const JIRA_EMAIL        = process.env.JIRA_EMAIL
const JIRA_API_TOKEN    = process.env.JIRA_API_TOKEN
const JIRA_PROJECT_KEY  = process.env.JIRA_PROJECT_KEY || 'SCRUM'

const c = {
  reset:  '\x1b[0m',
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  blue:   (s) => `\x1b[34m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  purple: (s) => `\x1b[35m${s}\x1b[0m`,
}

// ══════════════════════════════════════════════════════════════════
// HERRAMIENTAS DE JIRA
// ══════════════════════════════════════════════════════════════════
const JIRA_TOOLS = [
  {
    name: 'jira_create_issue',
    description: 'Crea un ticket/bug en Jira. Úsalo cuando el usuario pida crear una tarea, bug o historia.',
    input_schema: {
      type: 'object',
      properties: {
        summary:     { type: 'string',  description: 'Título del ticket (máx 255 chars)' },
        description: { type: 'string',  description: 'Descripción técnica detallada' },
        issuetype:   { type: 'string',  enum: ['Bug', 'Story', 'Task'], description: 'Tipo de issue' },
        priority:    { type: 'string',  enum: ['Highest', 'High', 'Medium', 'Low'], description: 'Prioridad' },
        labels:      { type: 'array',   items: { type: 'string' }, description: 'Etiquetas' },
      },
      required: ['summary', 'issuetype'],
    },
  },
  {
    name: 'jira_search_issues',
    description: 'Busca tickets en Jira con JQL. Úsalo para listar bugs, consultar estado, analizar patrones.',
    input_schema: {
      type: 'object',
      properties: {
        jql:        { type: 'string', description: 'Query JQL, ej: "project=SCRUM AND labels=cypress-e2e"' },
        maxResults: { type: 'number', description: 'Máximo resultados (default 10)' },
      },
      required: ['jql'],
    },
  },
  {
    name: 'jira_get_issue',
    description: 'Obtiene detalles completos de un ticket específico por su clave (ej: SCRUM-5).',
    input_schema: {
      type: 'object',
      properties: {
        issueKey: { type: 'string', description: 'Clave del ticket, ej: SCRUM-5' },
      },
      required: ['issueKey'],
    },
  },
  {
    name: 'jira_update_issue',
    description: 'Actualiza un ticket existente (prioridad, descripción, estado).',
    input_schema: {
      type: 'object',
      properties: {
        issueKey:    { type: 'string', description: 'Clave del ticket' },
        summary:     { type: 'string', description: 'Nuevo título' },
        description: { type: 'string', description: 'Nueva descripción' },
        priority:    { type: 'string', enum: ['Highest', 'High', 'Medium', 'Low'] },
        status:      { type: 'string', description: 'Nuevo estado: In Progress, Done, To Do' },
      },
      required: ['issueKey'],
    },
  },
  {
    name: 'jira_add_comment',
    description: 'Agrega un comentario a un ticket existente.',
    input_schema: {
      type: 'object',
      properties: {
        issueKey: { type: 'string', description: 'Clave del ticket' },
        comment:  { type: 'string', description: 'Texto del comentario' },
      },
      required: ['issueKey', 'comment'],
    },
  },
  {
    name: 'jira_get_project_summary',
    description: 'Obtiene resumen completo del proyecto: total por estado, bugs urgentes, tickets de QA.',
    input_schema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Clave del proyecto' },
      },
      required: [],
    },
  },
  {
    name: 'read_cypress_results',
    description: 'Lee los últimos resultados de tests de Cypress del proyecto local.',
    input_schema: {
      type: 'object',
      properties: {
        filter: { type: 'string', enum: ['all', 'failed', 'passed'], description: 'Filtro' },
      },
      required: [],
    },
  },
]

// ══════════════════════════════════════════════════════════════════
// JIRA API
// ══════════════════════════════════════════════════════════════════
function jiraAuth() {
  return 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')
}

function toADF(text) {
  return {
    type: 'doc', version: 1,
    content: (text || '').split('\n\n').filter(Boolean).map(para => ({
      type: 'paragraph',
      content: [{ type: 'text', text: para }],
    })),
  }
}

async function jiraFetch(endpoint, options = {}) {
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    throw new Error('Credenciales de Jira no configuradas en .env')
  }
  const res = await fetch(`${JIRA_BASE_URL}/rest/api/3${endpoint}`, {
    ...options,
    headers: {
      'Authorization': jiraAuth(),
      'Content-Type':  'application/json',
      'Accept':        'application/json',
      ...options.headers,
    },
  })
  let data
  try { data = await res.json() } catch { data = {} }
  return { ok: res.ok, status: res.status, data }
}

// ══════════════════════════════════════════════════════════════════
// EJECUTORES DE HERRAMIENTAS
// ══════════════════════════════════════════════════════════════════
async function executeTool(name, input) {
  switch (name) {

    case 'jira_create_issue': {
      const body = {
        fields: {
          project:     { key: JIRA_PROJECT_KEY },
          summary:     input.summary,
          issuetype:   { name: input.issuetype || 'Bug' },
          priority:    { name: input.priority  || 'Medium' },
          labels:      input.labels || ['cypress-qa'],
          description: toADF(input.description || ''),
        },
      }
      const r = await jiraFetch('/issue', { method: 'POST', body: JSON.stringify(body) })
      return r.ok
        ? { success: true,  key: r.data.key, url: `${JIRA_BASE_URL}/browse/${r.data.key}` }
        : { success: false, error: JSON.stringify(r.data.errors || r.data) }
    }

    case 'jira_search_issues': {
      const max = input.maxResults || 10
      const r = await jiraFetch(
        `/search?jql=${encodeURIComponent(input.jql)}&maxResults=${max}&fields=summary,status,priority,assignee,labels,created,updated`
      )
      if (!r.ok) return { success: false, error: JSON.stringify(r.data) }
      return {
        success: true,
        total:   r.data.total,
        issues:  (r.data.issues || []).map(i => ({
          key:      i.key,
          summary:  i.fields.summary,
          status:   i.fields.status?.name,
          priority: i.fields.priority?.name,
          assignee: i.fields.assignee?.displayName || 'Sin asignar',
          labels:   i.fields.labels,
          url:      `${JIRA_BASE_URL}/browse/${i.key}`,
        })),
      }
    }

    case 'jira_get_issue': {
      const r = await jiraFetch(`/issue/${input.issueKey}`)
      if (!r.ok) return { success: false, error: `Ticket ${input.issueKey} no encontrado` }
      const f = r.data.fields
      return {
        success:     true,
        key:         r.data.key,
        summary:     f.summary,
        status:      f.status?.name,
        priority:    f.priority?.name,
        assignee:    f.assignee?.displayName || 'Sin asignar',
        labels:      f.labels,
        description: f.description?.content?.[0]?.content?.[0]?.text || '',
        created:     f.created,
        url:         `${JIRA_BASE_URL}/browse/${r.data.key}`,
      }
    }

    case 'jira_update_issue': {
      const updates = { fields: {} }
      if (input.summary)     updates.fields.summary     = input.summary
      if (input.priority)    updates.fields.priority    = { name: input.priority }
      if (input.description) updates.fields.description = toADF(input.description)

      if (Object.keys(updates.fields).length > 0) {
        await jiraFetch(`/issue/${input.issueKey}`, { method: 'PUT', body: JSON.stringify(updates) })
      }

      if (input.status) {
        const trans = await jiraFetch(`/issue/${input.issueKey}/transitions`)
        if (trans.ok) {
          const match = trans.data.transitions?.find(t =>
            t.name.toLowerCase().includes(input.status.toLowerCase())
          )
          if (match) {
            await jiraFetch(`/issue/${input.issueKey}/transitions`, {
              method: 'POST',
              body: JSON.stringify({ transition: { id: match.id } }),
            })
          }
        }
      }
      return { success: true, message: `Ticket ${input.issueKey} actualizado`, url: `${JIRA_BASE_URL}/browse/${input.issueKey}` }
    }

    case 'jira_add_comment': {
      const r = await jiraFetch(`/issue/${input.issueKey}/comment`, {
        method: 'POST',
        body: JSON.stringify({ body: toADF(input.comment) }),
      })
      return r.ok
        ? { success: true,  message: `Comentario agregado a ${input.issueKey}` }
        : { success: false, error: JSON.stringify(r.data) }
    }

    case 'jira_get_project_summary': {
      const key = input.projectKey || JIRA_PROJECT_KEY
      const [toDo, inProg, done, urgent, qaTickets] = await Promise.all([
        jiraFetch(`/search?jql=${encodeURIComponent(`project=${key} AND status="To Do"`)}&maxResults=0`),
        jiraFetch(`/search?jql=${encodeURIComponent(`project=${key} AND status="In Progress"`)}&maxResults=0`),
        jiraFetch(`/search?jql=${encodeURIComponent(`project=${key} AND status="Done"`)}&maxResults=0`),
        jiraFetch(`/search?jql=${encodeURIComponent(`project=${key} AND priority in (Highest,High) AND status!="Done"`)}&maxResults=5&fields=summary,priority,assignee`),
        jiraFetch(`/search?jql=${encodeURIComponent(`project=${key} AND labels=autonomous-qa ORDER BY created DESC`)}&maxResults=5&fields=summary,status,created`),
      ])
      return {
        success: true,
        project: key,
        counts: {
          toDo:       toDo.data?.total       || 0,
          inProgress: inProg.data?.total     || 0,
          done:       done.data?.total       || 0,
        },
        urgentIssues: (urgent.data?.issues || []).map(i => ({
          key:      i.key,
          summary:  i.fields.summary,
          priority: i.fields.priority?.name,
          assignee: i.fields.assignee?.displayName || 'Sin asignar',
          url:      `${JIRA_BASE_URL}/browse/${i.key}`,
        })),
        autonomousQaTickets: (qaTickets.data?.issues || []).map(i => ({
          key:     i.key,
          summary: i.fields.summary,
          status:  i.fields.status?.name,
          url:     `${JIRA_BASE_URL}/browse/${i.key}`,
        })),
      }
    }

    case 'read_cypress_results': {
      for (const p of ['cypress/results/output.json', 'cypress-results.json']) {
        if (fs.existsSync(p)) {
          return { success: true, source: p, data: JSON.parse(fs.readFileSync(p, 'utf8')) }
        }
      }
      // Screenshots = evidencia de tests fallados
      if (fs.existsSync('cypress/screenshots')) {
        const files = fs.readdirSync('cypress/screenshots', { recursive: true })
          .filter(f => String(f).endsWith('.png'))
        if (files.length > 0) {
          return { success: true, source: 'screenshots', failedTests: files, note: 'Cada screenshot = test fallado' }
        }
      }
      // Datos documentados de failures.cy.js
      return {
        success: true,
        source:  'failures.cy.js (documentados)',
        failedTests: [
          { title: 'Ruta /dashboard no existe',                  category: 'Navegación',  severity: 'High',   type: 'selector'   },
          { title: 'Enlace ¿Olvidaste tu contraseña? no existe', category: 'Navegación',  severity: 'High',   type: 'selector'   },
          { title: 'Página /profile no accesible',               category: 'Navegación',  severity: 'Medium', type: 'navigation' },
          { title: 'Input acepta texto con solo espacios',        category: 'Validación',  severity: 'Medium', type: 'validation' },
          { title: 'Email inválido sin error inmediato',          category: 'Validación',  severity: 'Medium', type: 'validation' },
          { title: 'Tarea con 120+ chars no se rechaza',          category: 'Validación',  severity: 'Low',    type: 'validation' },
        ],
        passedTests: [
          { title: 'La app debe cargar en menos de 1500ms', category: 'Rendimiento', note: 'Pasa en CI actual' },
          { title: 'XSS en campo de tarea',                 category: 'Seguridad',   note: 'React escapa correctamente' },
        ],
      }
    }

    default:
      return { success: false, error: `Herramienta desconocida: ${name}` }
  }
}

// ══════════════════════════════════════════════════════════════════
// CLAUDE CON HERRAMIENTAS — QA Lead mode
// ══════════════════════════════════════════════════════════════════
async function runWithClaude(userPrompt) {
  if (!ANTHROPIC_API_KEY) {
    console.error(c.red('\n❌ ANTHROPIC_API_KEY no encontrada en .env\n'))
    console.error(c.dim('   Agrégala en tu .env o en https://console.anthropic.com/settings/billing\n'))
    process.exit(1)
  }

  const systemPrompt = `Eres el QA Lead y Engineering Manager del proyecto TaskFlow.
Stack: React + Vite + Supabase + Cypress + GitHub Actions + Vercel.
Jira: ${JIRA_BASE_URL} | Proyecto: ${JIRA_PROJECT_KEY}

INSTRUCCIONES CLAVE:
- Actúa como Tech Lead senior que conoce el proyecto al detalle
- USA SIEMPRE las herramientas para obtener datos reales antes de responder
- NUNCA inventes información — si no tienes datos, búscalos con las herramientas
- Responde en español de forma técnica, directa y accionable

PATRONES DE USO:
- "tests fallando" → read_cypress_results + jira_search_issues label=cypress-e2e
- "bugs abiertos" → jira_search_issues project=${JIRA_PROJECT_KEY} AND status!="Done"
- "crear tareas" → read_cypress_results → jira_create_issue por cada fallo relevante
- "resumen/estado" → jira_get_project_summary
- "ticket SCRUM-X" → jira_get_issue
- "módulo inestable" → jira_search_issues agrupando por labels
- "tickets del agente" → jira_search_issues label=autonomous-qa
- "regresiones" → jira_search_issues label=regression
- "sin asignar" → jql: assignee is EMPTY AND status!="Done"

Cuando presentes resultados, incluye siempre:
- Número de items encontrados
- Links clickeables a Jira cuando sea relevante
- Recomendaciones accionables basadas en los datos`

  const messages = [{ role: 'user', content: userPrompt }]
  console.log(c.dim('\n  Consultando...\n'))

  let iteration = 0
  while (iteration < 10) {
    iteration++

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system:     systemPrompt,
        tools:      JIRA_TOOLS,
        messages,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Claude API ${res.status}: ${err}`)
    }

    const response = await res.json()
    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') {
      const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
      if (text) {
        console.log(c.bold('\n🤖 QA Lead:\n'))
        console.log('  ' + text.split('\n').join('\n  '))
        console.log()
      }
      break
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults = []
      for (const toolUse of response.content.filter(b => b.type === 'tool_use')) {
        console.log(c.cyan(`  🔧 ${toolUse.name}`))
        if (Object.keys(toolUse.input).length > 0) {
          console.log(c.dim(`     ${JSON.stringify(toolUse.input)}`))
        }
        let result
        try {
          result = await executeTool(toolUse.name, toolUse.input)
          if (result.key)   console.log(c.green(`  ✅ ${result.key} — ${result.url}`))
          else if (result.success !== false) console.log(c.green(`  ✅ OK`))
          else              console.log(c.red(`  ❌ ${result.error}`))
        } catch (err) {
          result = { success: false, error: err.message }
          console.log(c.red(`  ❌ ${err.message}`))
        }
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) })
      }
      console.log()
      messages.push({ role: 'user', content: toolResults })
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// MODO INTERACTIVO
// ══════════════════════════════════════════════════════════════════
function interactiveMode() {
  console.log(c.bold(c.purple('\n  ╔══════════════════════════════════════════╗')))
  console.log(c.bold(c.purple('  ║   Claude QA Lead — TaskFlow              ║')))
  console.log(c.bold(c.purple('  ╚══════════════════════════════════════════╝\n')))
  console.log(c.dim(`  Jira:     ${JIRA_BASE_URL || '⚠️  no configurado'}`))
  console.log(c.dim(`  Proyecto: ${JIRA_PROJECT_KEY}`))
  console.log(c.dim('  Escribe "salir" para terminar\n'))
  console.log(c.dim('  Ejemplos:'))
  console.log(c.dim('  · ¿Qué tests están fallando más?'))
  console.log(c.dim('  · ¿Qué módulo tiene más bugs?'))
  console.log(c.dim('  · Crea tareas en Jira basadas en los tests fallados'))
  console.log(c.dim('  · ¿Qué tickets creó el agente autónomo?'))
  console.log(c.dim('  · Dame un resumen del estado del proyecto'))
  console.log(c.dim('  · Explícame el bug SCRUM-3'))
  console.log(c.dim('  · ¿Qué bugs siguen sin asignar?\n'))

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const ask = () => {
    rl.question(c.bold('  › '), async (input) => {
      const prompt = input.trim()
      if (!prompt) { ask(); return }
      if (['salir', 'exit', 'quit'].includes(prompt.toLowerCase())) {
        console.log(c.dim('\n  Hasta luego.\n'))
        rl.close()
        return
      }
      try { await runWithClaude(prompt) } catch (err) {
        console.error(c.red(`\n  Error: ${err.message}\n`))
      }
      ask()
    })
  }
  ask()
}

// ══════════════════════════════════════════════════════════════════
const args = process.argv.slice(2)
if (args.length === 0) {
  interactiveMode()
} else {
  const prompt = args.join(' ')
  console.log(c.bold(c.purple('\n  Claude QA Lead — TaskFlow\n')))
  console.log(c.dim(`  Prompt: "${prompt}"\n`))
  runWithClaude(prompt)
    .then(() => process.exit(0))
    .catch(err => { console.error(c.red(`\n❌ ${err.message}\n`)); process.exit(1) })
}
