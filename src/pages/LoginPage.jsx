import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AuthLayout from '../components/AuthLayout'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')

    if (!email) { setError('El correo es requerido.'); return }
    if (!password) { setError('La contraseña es requerida.'); return }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      if (error.message.includes('Invalid login')) {
        setError('Correo o contraseña incorrectos.')
      } else {
        setError(error.message)
      }
    }
    // Si no hay error, App.jsx detecta el cambio de sesión y redirige a /app
  }

  return (
    <AuthLayout title="Bienvenido de vuelta" subtitle="Inicia sesión para ver tus tareas.">
      <form className="auth-form" onSubmit={handleLogin} data-cy="login-form" noValidate>
        {error && <p className="form-error" data-cy="auth-error">{error}</p>}

        <div className="form-group">
          <label className="form-label" htmlFor="email">Correo electrónico</label>
          <input
            id="email"
            type="email"
            className={`form-input ${error ? 'error' : ''}`}
            placeholder="tu@correo.com"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            data-cy="email-input"
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            className={`form-input ${error ? 'error' : ''}`}
            placeholder="••••••••"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            data-cy="password-input"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          data-cy="submit-btn"
        >
          {loading ? 'Ingresando...' : 'Iniciar sesión'}
        </button>
      </form>

      <p className="auth-footer">
        ¿No tienes cuenta?{' '}
        <Link to="/register" className="auth-link" data-cy="go-register">
          Regístrate gratis
        </Link>
      </p>
    </AuthLayout>
  )
}
