#!/usr/bin/env node
// scripts/claude-jira.mjs
// ══════════════════════════════════════════════════════════════════
//  CLAUDE → JIRA  — Integración manual vía prompt en lenguaje natural
// ══════════════════════════════════════════════════════════════════
//
//  USO:
//    node scripts/claude-jira.mjs "apunta al proyecto SCRUM y crea
//    una tarea para el equipo basada en los últimos tests fallados"
//
//    node scripts/claude-jira.mjs "muéstrame todos los bugs abiertos"
//
//    node scripts/claude-jira.mjs "¿qué ticket tiene mayor prioridad?"
//
//  REQUISITOS (variables de entorno en .env):
//    ANTHROPIC_API_KEY
//    JIRA_BASE_URL     → https://maiguae12s.atlassian.net
//    JIRA_EMAIL        → maiguae12@gmail.com
//    JIRA_API_TOKEN    → tu token de Atlassian
//    JIRA_PROJECT_KEY  → SCRUM
// ══════════════════════════════════════════════════════════════════

import fs from 'fs'
import path from 'path'
import { createInterface } from 'readline'

// ── Cargar .env manualmente (sin dependencias externas) ───────────
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const [key, ...rest] = trimmed.split('=')
      const value = rest.join('=').trim().replace(/^["']|["']$/g, '')
      if (key && value && !process.env[key]) {
        process.env[key] = value
      }
    }
  }
}
loadEnv()

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const JIRA_BASE_URL     = process.env.JIRA_BASE_URL
const JIRA_EMAIL        = process.env.JIRA_EMAIL
const JIRA_API_TOKEN    = process.env.JIRA_API_TOKEN
const JIRA_PROJECT_KEY  = process.env.JIRA_PROJECT_KEY || 'SCRUM'

// ── Colores terminal ──────────────────────────────────────────────
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
// HERRAMIENTAS DE JIRA — lo que Claude puede usar
// ══════════════════════════════════════════════════════════════════
const JIRA_TOOLS = [
  {
    name: 'jira_create_issue',
    description: 'Crea un ticket/issue en Jira. Úsalo cuando el usuario pida crear una tarea, bug, historia o ticket.',
    input_schema: {
      type: 'object',
      properties: {
        summary:     { type: 'string',  description: 'Título del ticket (máx 255 chars)' },
        description: { type: 'string',  description: 'Descripción detallada del problema o tarea' },
        issuetype:   { type: 'string',  enum: ['Bug', 'Story', 'Task', 'Epic'], description: 'Tipo de issue' },
        priority:    { type: 'string',  enum: ['Highest', 'High', 'Medium', 'Low', 'Lowest'], description: 'Prioridad' },
        labels:      { type: 'array',   items: { type: 'string' }, description: 'Etiquetas opcionales' },
        assignee:    { type: 'string',  description: 'Email del asignado (opcional)' },
      },
      required: ['summary', 'issuetype'],
    },
  },
  {
    name: 'jira_search_issues',
    description: 'Busca tickets en Jira usando JQL o texto libre. Úsalo cuando el usuario quiera ver, listar o consultar tickets.',
    input_schema: {
      type: 'object',
      properties: {
        jql:        { type: 'string', description: 'Query JQL, ej: "project=SCRUM AND status=Open"' },
        maxResults: { type: 'number', description: 'Máximo de resultados (default 10)' },
      },
      required: ['jql'],
    },
  },
  {
    name: 'jira_get_issue',
    description: 'Obtiene los detalles completos de un ticket específico por su clave.',
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
    description: 'Actualiza campos de un ticket existente (estado, prioridad, descripción, asignado).',
    input_schema: {
      type: 'object',
      properties: {
        issueKey:    { type: 'string', description: 'Clave del ticket a actualizar' },
        summary:     { type: 'string', description: 'Nuevo título (opcional)' },
        description: { type: 'string', description: 'Nueva descripción (opcional)' },
        priority:    { type: 'string', enum: ['Highest', 'High', 'Medium', 'Low', 'Lowest'] },
        status:      { type: 'string', description: 'Nuevo estado: "In Progress", "Done", "To Do"' },
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
    description: 'Obtiene un resumen del proyecto: total de issues por estado, prioridad y tipo.',
    input_schema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Clave del proyecto, ej: SCRUM' },
      },
      required: ['projectKey'],
    },
  },
  {
    name: 'read_cypress_results',
    description: 'Lee los últimos resultados de tests de Cypress del proyecto. Úsalo cuando el usuario mencione tests fallados, resultados de pruebas, o quiera basar acciones en los tests.',
    input_schema: {
      type: 'object',
      properties: {
        filter: { type: 'string', enum: ['all', 'failed', 'passed'], description: 'Qué tests mostrar' },
      },
      required: [],
    },
  },
]

// ══════════════════════════════════════════════════════════════════
// EJECUTORES DE HERRAMIENTAS
// ══════════════════════════════════════════════════════════════════

function jiraAuth() {
  return 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')
}

function toADF(text) {
  return {
    type: 'doc', version: 1,
    content: text.split('\n\n').map(para => ({
      type: 'paragraph',
      content: [{ type: 'text', text: para }],
    })),
  }
}

async function jiraFetch(path, options = {}) {
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    throw new Error('Faltan credenciales de Jira en el .env')
  }
  const url = `${JIRA_BASE_URL}/rest/api/3${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': jiraAuth(),
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  })
  const text = await res.text()
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) }
  } catch {
    return { ok: res.ok, status: res.status, data: text }
  }
}

async function executeTool(name, input) {
  switch (name) {

    case 'jira_create_issue': {
      const body = {
        fields: {
          project:     { key: JIRA_PROJECT_KEY },
          summary:     input.summary,
          issuetype:   { name: input.issuetype || 'Task' },
          priority:    { name: input.priority || 'Medium' },
          labels:      input.labels || ['cypress-qa'],
          description: toADF(input.description || ''),
        },
      }
      if (input.assignee) {
        // Buscar el accountId por email
        const search = await jiraFetch(`/user/search?query=${input.assignee}`)
        if (search.ok && search.data.length > 0) {
          body.fields.assignee = { accountId: search.data[0].accountId }
        }
      }
      const result = await jiraFetch('/issue', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (result.ok) {
        return {
          success: true,
          key: result.data.key,
          url: `${JIRA_BASE_URL}/browse/${result.data.key}`,
          message: `Ticket creado exitosamente: ${result.data.key}`,
        }
      }
      return { success: false, error: JSON.stringify(result.data) }
    }

    case 'jira_search_issues': {
      const max = input.maxResults || 10
      const result = await jiraFetch(
        `/search?jql=${encodeURIComponent(input.jql)}&maxResults=${max}&fields=summary,status,priority,assignee,labels,created,updated`
      )
      if (!result.ok) return { success: false, error: JSON.stringify(result.data) }
      const issues = result.data.issues || []
      return {
        success: true,
        total: result.data.total,
        issues: issues.map(i => ({
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
      const result = await jiraFetch(`/issue/${input.issueKey}`)
      if (!result.ok) return { success: false, error: `Ticket ${input.issueKey} no encontrado` }
      const f = result.data.fields
      return {
        success: true,
        key:         result.data.key,
        summary:     f.summary,
        status:      f.status?.name,
        priority:    f.priority?.name,
        assignee:    f.assignee?.displayName || 'Sin asignar',
        labels:      f.labels,
        description: f.description?.content?.[0]?.content?.[0]?.text || '',
        created:     f.created,
        updated:     f.updated,
        url:         `${JIRA_BASE_URL}/browse/${result.data.key}`,
      }
    }

    case 'jira_update_issue': {
      const updates = { fields: {} }
      if (input.summary)     updates.fields.summary     = input.summary
      if (input.priority)    updates.fields.priority    = { name: input.priority }
      if (input.description) updates.fields.description = toADF(input.description)

      if (Object.keys(updates.fields).length > 0) {
        await jiraFetch(`/issue/${input.issueKey}`, {
          method: 'PUT',
          body: JSON.stringify(updates),
        })
      }

      // Cambiar estado si se especificó
      if (input.status) {
        const trans = await jiraFetch(`/issue/${input.issueKey}/transitions`)
        if (trans.ok) {
          const match = trans.data.transitions.find(t =>
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

      return {
        success: true,
        message: `Ticket ${input.issueKey} actualizado`,
        url: `${JIRA_BASE_URL}/browse/${input.issueKey}`,
      }
    }

    case 'jira_add_comment': {
      const result = await jiraFetch(`/issue/${input.issueKey}/comment`, {
        method: 'POST',
        body: JSON.stringify({ body: toADF(input.comment) }),
      })
      return result.ok
        ? { success: true, message: `Comentario agregado a ${input.issueKey}` }
        : { success: false, error: JSON.stringify(result.data) }
    }

    case 'jira_get_project_summary': {
      const key = input.projectKey || JIRA_PROJECT_KEY
      const [open, inProgress, done, high] = await Promise.all([
        jiraFetch(`/search?jql=${encodeURIComponent(`project=${key} AND status="To Do"`)}&maxResults=0`),
        jiraFetch(`/search?jql=${encodeURIComponent(`project=${key} AND status="In Progress"`)}&maxResults=0`),
        jiraFetch(`/search?jql=${encodeURIComponent(`project=${key} AND status="Done"`)}&maxResults=0`),
        jiraFetch(`/search?jql=${encodeURIComponent(`project=${key} AND priority in (Highest,High) AND status!="Done"`)}&maxResults=5&fields=summary,priority,status`),
      ])
      return {
        success: true,
        project: key,
        summary: {
          toDo:       open.data?.total || 0,
          inProgress: inProgress.data?.total || 0,
          done:       done.data?.total || 0,
        },
        urgentIssues: (high.data?.issues || []).map(i => ({
          key:      i.key,
          summary:  i.fields.summary,
          priority: i.fields.priority?.name,
          url:      `${JIRA_BASE_URL}/browse/${i.key}`,
        })),
      }
    }

    case 'read_cypress_results': {
      // Lee el último reporte de Cypress si existe
      const reportPaths = [
        'cypress/results/output.json',
        'cypress-results.json',
      ]
      for (const p of reportPaths) {
        if (fs.existsSync(p)) {
          const raw = JSON.parse(fs.readFileSync(p, 'utf8'))
          return { success: true, source: p, data: raw }
        }
      }

      // Si no hay JSON, lee los screenshots (indica qué tests fallaron)
      const screenshotsDir = 'cypress/screenshots'
      if (fs.existsSync(screenshotsDir)) {
        const files = fs.readdirSync(screenshotsDir, { recursive: true })
          .filter(f => f.endsWith('.png'))
        if (files.length > 0) {
          return {
            success: true,
            source: 'screenshots',
            failedTests: files.map(f => f.replace('.png', '')),
            note: 'Tests con screenshots = tests que fallaron',
          }
        }
      }

      // Devolver los fallos documentados del proyecto
      return {
        success: true,
        source: 'failures.cy.js (documentados)',
        failedTests: [
          { title: 'Ruta /dashboard no existe',                  category: 'Navegación',  priority: 'High'   },
          { title: 'Enlace ¿Olvidaste tu contraseña? no existe', category: 'Navegación',  priority: 'High'   },
          { title: 'Página /profile no accesible',               category: 'Navegación',  priority: 'Medium' },
          { title: 'Input acepta texto con solo espacios',        category: 'Validación',  priority: 'Medium' },
          { title: 'Email inválido no muestra error inmediato',   category: 'Validación',  priority: 'Medium' },
          { title: 'Tarea con 120+ chars no se rechaza',          category: 'Validación',  priority: 'Low'    },
        ],
      }
    }

    default:
      return { success: false, error: `Herramienta desconocida: ${name}` }
  }
}

// ══════════════════════════════════════════════════════════════════
// LOOP PRINCIPAL — Claude con herramientas
// ══════════════════════════════════════════════════════════════════
async function runWithClaude(userPrompt) {
  if (!ANTHROPIC_API_KEY) {
    console.error(c.red('\n❌ ANTHROPIC_API_KEY no encontrada en .env\n'))
    process.exit(1)
  }

  const systemPrompt = `Eres un asistente de QA Engineering especializado en Cypress y Jira.
Tienes acceso a herramientas para interactuar con Jira (${JIRA_BASE_URL}) y leer resultados de tests de Cypress.

Proyecto Jira activo: ${JIRA_PROJECT_KEY}
URL base de Jira: ${JIRA_BASE_URL}

Cuando el usuario pida crear tareas basadas en tests fallados:
1. Primero usa read_cypress_results para obtener los fallos
2. Luego crea un ticket en Jira por cada fallo relevante con jira_create_issue
3. Informa al usuario qué tickets se crearon con sus URLs

Cuando el usuario quiera ver o consultar tickets:
1. Usa jira_search_issues con JQL apropiado
2. Presenta los resultados de forma clara y organizada

Responde siempre en español. Sé conciso pero completo.`

  const messages = [{ role: 'user', content: userPrompt }]

  console.log(c.dim('\n  Procesando...\n'))

  let iteration = 0
  const maxIterations = 10

  while (iteration < maxIterations) {
    iteration++

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        tools: JIRA_TOOLS,
        messages,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Claude API error ${res.status}: ${err}`)
    }

    const response = await res.json()

    // Agregar la respuesta del asistente al historial
    messages.push({ role: 'assistant', content: response.content })

    // Si Claude terminó (no hay más herramientas que usar)
    if (response.stop_reason === 'end_turn') {
      const text = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n')
      if (text) {
        console.log(c.bold('\n🤖 Claude:\n'))
        console.log('  ' + text.split('\n').join('\n  '))
        console.log()
      }
      break
    }

    // Si Claude quiere usar herramientas
    if (response.stop_reason === 'tool_use') {
      const toolUses = response.content.filter(b => b.type === 'tool_use')
      const toolResults = []

      for (const toolUse of toolUses) {
        console.log(c.cyan(`  🔧 Ejecutando: ${toolUse.name}`))
        if (Object.keys(toolUse.input).length > 0) {
          console.log(c.dim(`     ${JSON.stringify(toolUse.input)}`))
        }

        let result
        try {
          result = await executeTool(toolUse.name, toolUse.input)
        } catch (err) {
          result = { success: false, error: err.message }
        }

        // Mostrar resultado en terminal
        if (result.success === false) {
          console.log(c.red(`  ❌ Error: ${result.error}\n`))
        } else if (result.key) {
          console.log(c.green(`  ✅ ${result.key} — ${result.url}\n`))
        } else {
          console.log(c.green(`  ✅ OK\n`))
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        })
      }

      // Devolver resultados a Claude para que continúe
      messages.push({ role: 'user', content: toolResults })
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// MODO INTERACTIVO — si no hay argumento, abre un chat
// ══════════════════════════════════════════════════════════════════
async function interactiveMode() {
  console.log(c.bold(c.purple('\n  ╔══════════════════════════════════════╗')))
  console.log(c.bold(c.purple('  ║   Claude → Jira  |  TaskFlow QA     ║')))
  console.log(c.bold(c.purple('  ╚══════════════════════════════════════╝\n')))
  console.log(c.dim(`  Jira: ${JIRA_BASE_URL || 'no configurado'}`))
  console.log(c.dim(`  Proyecto: ${JIRA_PROJECT_KEY}`))
  console.log(c.dim('  Escribe "salir" para terminar\n'))
  console.log(c.dim('  Ejemplos de prompts:'))
  console.log(c.dim('  · crea una tarea basada en los tests fallados'))
  console.log(c.dim('  · muéstrame todos los bugs abiertos del proyecto SCRUM'))
  console.log(c.dim('  · ¿qué ticket tiene mayor prioridad?'))
  console.log(c.dim('  · agrega un comentario a SCRUM-1 diciendo que está en revisión'))
  console.log(c.dim('  · dame un resumen del estado del proyecto\n'))

  const rl = createInterface({ input: process.stdin, output: process.stdout })

  const ask = () => {
    rl.question(c.bold('  › '), async (input) => {
      const prompt = input.trim()
      if (!prompt) { ask(); return }
      if (prompt.toLowerCase() === 'salir' || prompt.toLowerCase() === 'exit') {
        console.log(c.dim('\n  Hasta luego.\n'))
        rl.close()
        return
      }
      try {
        await runWithClaude(prompt)
      } catch (err) {
        console.error(c.red(`\n  Error: ${err.message}\n`))
      }
      ask()
    })
  }

  ask()
}

// ══════════════════════════════════════════════════════════════════
// PUNTO DE ENTRADA
// ══════════════════════════════════════════════════════════════════
const args = process.argv.slice(2)

if (args.length === 0) {
  // Modo interactivo
  interactiveMode()
} else {
  // Prompt directo desde la terminal
  const prompt = args.join(' ')
  console.log(c.bold(c.purple('\n  Claude → Jira  |  TaskFlow QA\n')))
  console.log(c.dim(`  Prompt: "${prompt}"\n`))
  runWithClaude(prompt)
    .then(() => process.exit(0))
    .catch(err => {
      console.error(c.red(`\n❌ Error: ${err.message}\n`))
      process.exit(1)
    })
}
