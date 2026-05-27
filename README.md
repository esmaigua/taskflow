# TaskFlow — Autonomous QA Pipeline

Aplicación de gestión de tareas con pipeline de QA autónomo completo.

## Stack
- **Frontend:** React + Vite
- **Backend/Auth/DB:** Supabase (PostgreSQL)
- **Tests:** Cypress + Cypress Cloud
- **CI/CD:** GitHub Actions
- **Deploy:** Vercel
- **Agente:** Claude AI + Jira

---

## Flujo completo

```
git push origin develop
        ↓
┌─────────────────────────────────────┐
│  ci-develop — Suite completa        │
│  auth + smoke + todos               │
│  Si falla → merge bloqueado ❌      │
│  Si pasa → merge disponible ✅      │
└─────────────────────────────────────┘
        ↓ (en paralelo)
┌─────────────────────────────────────┐
│  ci-failures — Fallos intencionales │
│  Nunca bloquea el merge             │
│  Alimenta al agente autónomo        │
└─────────────────────────────────────┘
        ↓ (automático al terminar)
┌─────────────────────────────────────┐
│  ci-qa-agent — Agente Autónomo      │
│  Claude analiza los fallos          │
│  Crea tickets en Jira               │
└─────────────────────────────────────┘

── Merge develop → main ──────────────

git push origin main
        ↓
┌─────────────────────────────────────┐
│  ci-main — Smoke Tests              │
│  Solo 6 tests críticos              │
│  Si pasan → Vercel despliega ✅     │
│  Si fallan → NO despliega ❌        │
└─────────────────────────────────────┘
```

---

## Setup local

### 1. Variables de entorno

```bash
cp .env.example .env
# Edita .env con tus credenciales
```

### 2. Instalar y correr

```bash
npm install
npm run dev
```

### 3. Tests con Cypress

```bash
# Modo visual (desarrollo)
npm run cypress:open

# Suite completa headless
npm run cypress:run

# Solo smoke tests
npm run cypress:smoke

# Suite de fallos intencionales
npm run cypress:failures
```

### 4. Agente autónomo + Jira (manual)

```bash
# Chat interactivo con Claude sobre Jira
npm run qa:chat

# Ejemplos de prompts:
npm run qa:chat "crea tareas en Jira basadas en los tests fallados"
npm run qa:chat "muéstrame los bugs abiertos del proyecto SCRUM"
npm run qa:chat "¿cuál es el ticket de mayor prioridad?"
npm run qa:chat "dame un resumen del estado del proyecto"
```

---

## Limpiar tareas de prueba en Supabase

Ejecutar en **Supabase → SQL Editor** cuando haya demasiadas tareas acumuladas:

```sql
DELETE FROM todos
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'test@taskflow.com'
);
```

---

## Secrets de GitHub necesarios

| Secret | Descripción |
|--------|-------------|
| `CYPRESS_RECORD_KEY` | Key de Cypress Cloud |
| `CYPRESS_PROJECT_ID` | ID del proyecto en Cypress Cloud |
| `STAGING_SUPABASE_URL` | URL de Supabase |
| `STAGING_SUPABASE_ANON_KEY` | Anon key de Supabase |
| `STAGING_TEST_EMAIL` | Email del usuario de prueba |
| `STAGING_TEST_PASSWORD` | Password del usuario de prueba |
| `PROD_SUPABASE_URL` | (igual que staging) |
| `PROD_SUPABASE_ANON_KEY` | (igual que staging) |
| `PROD_TEST_EMAIL` | (igual que staging) |
| `PROD_TEST_PASSWORD` | (igual que staging) |
| `ANTHROPIC_API_KEY` | API key de Anthropic |
| `JIRA_BASE_URL` | https://maiguae12s.atlassian.net |
| `JIRA_EMAIL` | maiguae12@gmail.com |
| `JIRA_API_TOKEN` | Token de Atlassian |
| `JIRA_PROJECT_KEY` | SCRUM |

---

## Estructura del proyecto

```
taskflow/
├── src/                          ← App React
├── cypress/
│   ├── e2e/
│   │   ├── smoke.cy.js           ← 6 tests críticos (producción)
│   │   ├── auth.cy.js            ← 14 tests de autenticación
│   │   ├── todos.cy.js           ← 18 tests de tareas
│   │   └── failures.cy.js        ← 9 fallos intencionales
│   └── support/
│       ├── commands.js           ← Comandos personalizados
│       └── e2e.js
├── scripts/
│   ├── qa-agent.mjs              ← Agente autónomo (CI)
│   └── claude-jira.mjs           ← Chat Claude→Jira (manual)
├── .github/workflows/
│   ├── ci-develop.yml            ← Suite completa staging
│   ├── ci-main.yml               ← Smoke tests producción
│   ├── ci-pr.yml                 ← Feature branches
│   ├── ci-failures.yml           ← Fallos intencionales
│   └── ci-qa-agent.yml           ← Agente autónomo
└── cypress.config.js             ← projectId: u8t5bf
```
