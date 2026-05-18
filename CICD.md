# 🔁 CI/CD con GitHub Actions + Cypress Cloud

Guía completa para configurar el pipeline de pruebas automáticas.

---

## 🌿 Estrategia de ramas

```
main          ← Producción (deploy a Vercel)
  └── develop ← Staging / integración
        └── feature/xxx  ← Trabajo nuevo
        └── fix/xxx      ← Correcciones
```

### Flujo de trabajo

```
1. Trabajas en feature/mi-feature
2. Abres PR → develop        → corre todos los tests (CI)
3. Se mergea → develop        → corre todos los tests (CI) + graba en Cypress Cloud
4. Abres PR → main           → corre smoke tests (CI)
5. Se mergea → main          → corre smoke tests (CI) + graba en Cypress Cloud + deploy Vercel
```

---

## ☁️ PASO 1 — Crear proyecto en Cypress Cloud

1. Ve a **[cloud.cypress.io](https://cloud.cypress.io)** → Sign Up (gratis con GitHub)
2. Clic en **"Create new project"**
3. Dale un nombre: `taskflow`
4. Copia el **Project ID** y el **Record Key** que te da

---

## 🔑 PASO 2 — Agregar Secrets en GitHub

Ve a tu repo en GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Agrega estos secrets:

| Secret | Valor |
|--------|-------|
| `CYPRESS_RECORD_KEY` | El Record Key de Cypress Cloud |
| `CYPRESS_PROJECT_ID` | El Project ID de Cypress Cloud |
| `STAGING_SUPABASE_URL` | URL de tu proyecto Supabase |
| `STAGING_SUPABASE_ANON_KEY` | Anon key de Supabase |
| `STAGING_TEST_EMAIL` | `test@taskflow.com` |
| `STAGING_TEST_PASSWORD` | `Test1234!` |
| `PROD_SUPABASE_URL` | (mismo que staging por ahora) |
| `PROD_SUPABASE_ANON_KEY` | (mismo que staging por ahora) |
| `PROD_TEST_EMAIL` | `test@taskflow.com` |
| `PROD_TEST_PASSWORD` | `Test1234!` |

> 💡 En un proyecto real, staging y producción tendrían bases de datos separadas.

---

## ⚙️ PASO 3 — Actualizar el projectId en cypress.config.js

Abre `cypress.config.js` y reemplaza `'xxxxxxx'` con tu Project ID real:

```js
projectId: 'tu_project_id_aqui',
```

---

## 🌿 PASO 4 — Crear las ramas en tu repo

```bash
# Estando en main:
git checkout -b develop
git push -u origin develop

# Para una feature nueva:
git checkout develop
git checkout -b feature/mi-nueva-funcionalidad
```

---

## 🧪 Qué corre en cada evento

| Evento | Workflow | Tests | Cypress Cloud |
|--------|----------|-------|---------------|
| Push a `feature/*` | — | — | — |
| PR hacia `develop` | `ci-develop.yml` | ✅ Todos | ✅ Graba |
| Push a `develop` | `ci-develop.yml` | ✅ Todos | ✅ Graba |
| PR hacia `main` | `ci-main.yml` | 🔥 Smoke | ✅ Graba |
| Push a `main` | `ci-main.yml` | 🔥 Smoke | ✅ Graba |
| PR hacia feature | `ci-pr.yml` | ⚡ Todos (sin grabar) | ❌ |

---

## 🔥 Archivos de tests y cuándo se usan

```
cypress/e2e/
├── smoke.cy.js    → Tests críticos, corren en producción (rápidos)
├── auth.cy.js     → Tests de autenticación completos
└── todos.cy.js    → Tests de gestión de tareas
```

---

## 📺 Ver resultados en Cypress Cloud

Una vez que el workflow corre con `record: true`, ve a:

**[cloud.cypress.io](https://cloud.cypress.io)** → tu proyecto → **Runs**

Podrás ver:
- ✅ / ❌ Estado de cada test
- 🎥 Video de cada run
- 📸 Screenshots de los fallos
- 📊 Historial y tendencias
- 🏷️ Tags: `staging`, `production`, `develop`, `main`

---

## 🚀 Flujo completo de ejemplo

```bash
# 1. Crear feature branch
git checkout develop
git checkout -b feature/agregar-prioridades

# 2. Hacer cambios...
# 3. Commit y push
git add .
git commit -m "feat: agregar prioridad a las tareas"
git push origin feature/agregar-prioridades

# 4. Abrir PR en GitHub: feature/agregar-prioridades → develop
#    → GitHub Actions corre CI (sin grabar en Cloud)
#    → Si pasan ✅, merge a develop

# 5. Al mergear a develop:
#    → GitHub Actions corre CI completo + graba en Cypress Cloud
#    → Si pasan ✅, abrir PR: develop → main

# 6. Al mergear a main:
#    → GitHub Actions corre smoke tests + graba en Cypress Cloud
#    → Vercel hace deploy automático de producción
```

---

## 🐛 Troubleshooting

**"No se conecta a Supabase en CI"**
→ Verifica que los secrets `STAGING_SUPABASE_URL` y `STAGING_SUPABASE_ANON_KEY` estén bien escritos en GitHub.

**"Tests fallan por usuario no encontrado"**
→ Crea el usuario de prueba en Supabase (Authentication → Users) y desactiva la confirmación de email.

**"Cypress Cloud no recibe resultados"**
→ Verifica que `CYPRESS_RECORD_KEY` y `CYPRESS_PROJECT_ID` estén en los secrets de GitHub.

**"El workflow no se dispara"**
→ Asegúrate de que los archivos `.github/workflows/*.yml` estén en la rama `main` o `develop` (GitHub Actions solo lee workflows del repo, no de branches nuevas hasta que se mergean).
