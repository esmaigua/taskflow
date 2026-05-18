# TaskFlow Full — Auth + DB + Cypress

Sistema completo con autenticación real, base de datos en Supabase y pruebas E2E con Cypress.

---

## 📋 Stack

- **Frontend**: React + Vite
- **Auth + DB**: Supabase (gratis)
- **Deploy**: Vercel (gratis)
- **Tests**: Cypress

---

## 🔧 PASO 1 — Crear proyecto en Supabase

1. Ve a **[supabase.com](https://supabase.com)** → Sign Up (con GitHub es más rápido)
2. Clic en **"New project"**
3. Elige un nombre (ej: `taskflow`) y una contraseña para la DB
4. Selecciona la región más cercana (US East o similar)
5. Espera ~2 minutos a que levante

---

## 🗄️ PASO 2 — Crear la tabla de tareas

En tu proyecto de Supabase, ve a **SQL Editor** y ejecuta:

```sql
-- Crear tabla de tareas
CREATE TABLE todos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL CHECK (char_length(text) >= 3),
  completed BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Habilitar Row Level Security (cada usuario solo ve sus tareas)
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Política: usuarios solo ven sus propias tareas
CREATE POLICY "Users can manage their own todos"
  ON todos
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## 🔑 PASO 3 — Obtener credenciales

1. En Supabase Dashboard → **Settings** → **API**
2. Copia:
   - **Project URL** (ej: `https://abcdefgh.supabase.co`)
   - **anon / public key** (el JWT largo)

---

## ⚙️ PASO 4 — Configurar variables de entorno

```bash
# Crea el archivo .env en la raíz del proyecto
cp .env.example .env
```

Edita `.env` y pega tus credenciales:

```env
VITE_SUPABASE_URL=https://TU_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...tu_clave_larga
```

---

## 🚀 PASO 5 — Instalar y correr

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` — deberías ver la pantalla de login.

Regístrate con un usuario de prueba desde la app (o desde Supabase Dashboard → Authentication → Users → Invite User).

---

## 🧪 PASO 6 — Configurar y correr Cypress

### Crear usuario de prueba

Antes de correr los tests, crea un usuario fijo en Supabase:

**Opción A** — Desde la app: Regístrate con `test@taskflow.com` / `Test1234!`

**Opción B** — Desde Supabase: Authentication → Users → "Invite user"

> Si Supabase pide confirmar email, desactívalo en:
> Authentication → Settings → **"Enable email confirmations"** → OFF (para desarrollo)

### Correr los tests

```bash
# Modo visual (recomendado)
npm run cypress:open

# Modo headless
npm run cypress:run
```

> ⚠️ `npm run dev` debe estar corriendo antes de abrir Cypress.

---

## ☁️ PASO 7 — Deploy en Vercel

### Con GitHub (recomendado)

1. Sube el proyecto a GitHub
2. Ve a [vercel.com](https://vercel.com) → Import Project → elige tu repo
3. En **Environment Variables** agrega:
   - `VITE_SUPABASE_URL` = tu URL
   - `VITE_SUPABASE_ANON_KEY` = tu clave
4. Deploy ✅

### Con CLI

```bash
npm install -g vercel
vercel
# Agrega las variables de entorno cuando lo pida
```

---

## 📁 Estructura del proyecto

```
taskflow-full/
├── src/
│   ├── lib/
│   │   └── supabase.js        # Cliente de Supabase
│   ├── components/
│   │   ├── AuthLayout.jsx     # Layout compartido auth
│   │   └── AuthLayout.css
│   ├── pages/
│   │   ├── LoginPage.jsx      # Página de login
│   │   ├── RegisterPage.jsx   # Página de registro
│   │   ├── TodoPage.jsx       # App principal de tareas
│   │   └── TodoPage.css
│   ├── App.jsx                # Router + protección de rutas
│   ├── main.jsx
│   └── index.css
├── cypress/
│   ├── e2e/
│   │   ├── auth.cy.js         # 🔐 Tests de autenticación
│   │   └── todos.cy.js        # ✅ Tests de tareas
│   └── support/
│       ├── commands.js        # Comandos personalizados
│       └── e2e.js
├── cypress.config.js
├── .env.example               # ← Copiar como .env
└── vercel.json
```

---

## 🏷️ Selectores `data-cy` disponibles

### Auth
| Selector | Elemento |
|---|---|
| `[data-cy=login-form]` | Formulario de login |
| `[data-cy=register-form]` | Formulario de registro |
| `[data-cy=email-input]` | Input de correo |
| `[data-cy=password-input]` | Input de contraseña |
| `[data-cy=confirm-input]` | Confirmar contraseña (registro) |
| `[data-cy=submit-btn]` | Botón de envío |
| `[data-cy=auth-error]` | Mensaje de error |
| `[data-cy=register-success]` | Mensaje de éxito |
| `[data-cy=go-register]` | Link "ir a registro" |
| `[data-cy=go-login]` | Link "ir a login" |

### App
| Selector | Elemento |
|---|---|
| `[data-cy=navbar]` | Barra de navegación |
| `[data-cy=user-email]` | Email del usuario |
| `[data-cy=logout-btn]` | Botón de cerrar sesión |
| `[data-cy=todo-input]` | Input nueva tarea |
| `[data-cy=add-btn]` | Botón añadir |
| `[data-cy=error-message]` | Error de validación |
| `[data-cy=todo-list]` | Lista de tareas |
| `[data-cy=todo-item]` | Cada tarea |
| `[data-cy=todo-text]` | Texto de la tarea |
| `[data-cy=toggle-btn]` | Completar/descompletar |
| `[data-cy=edit-btn]` | Editar |
| `[data-cy=delete-btn]` | Eliminar |
| `[data-cy=edit-input]` | Input de edición |
| `[data-cy=save-edit-btn]` | Guardar edición |
| `[data-cy=cancel-edit-btn]` | Cancelar edición |
| `[data-cy=filter-todas]` | Filtro todas |
| `[data-cy=filter-activas]` | Filtro activas |
| `[data-cy=filter-completadas]` | Filtro completadas |
| `[data-cy=clear-completed]` | Limpiar completadas |
| `[data-cy=active-count]` | Contador pendientes |
| `[data-cy=empty-state]` | Estado vacío |

---

## 🩺 Solución de problemas

**"Error de CORS" o "fetch failed"**: Verifica que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` estén correctas en `.env`.

**"Email not confirmed"**: En Supabase → Authentication → Settings → desactiva "Enable email confirmations" para desarrollo.

**Tests de Cypress fallan en login**: Asegúrate de que el usuario `test@taskflow.com` / `Test1234!` existe en Supabase y la confirmación de email está desactivada.
