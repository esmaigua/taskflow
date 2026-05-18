import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AuthLayout from '../components/AuthLayout'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')

    if (!email) { setError('El correo es requerido.'); return }
    if (!password) { setError('La contraseña es requerida.'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }

    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)

    if (error) {
      if (error.message.includes('already registered')) {
        setError('Este correo ya está registrado.')
      } else {
        setError(error.message)
      }
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <AuthLayout title="¡Cuenta creada!" subtitle="Ya puedes iniciar sesión con tu cuenta.">
        <div className="form-success" data-cy="register-success">
          Registro exitoso. Dependiendo de la configuración de Supabase, puede que necesites confirmar tu correo.
        </div>
        <p className="auth-footer" style={{ marginTop: 20 }}>
          <Link to="/login" className="auth-link" data-cy="go-login-from-success">
            Ir a iniciar sesión →
          </Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Crea tu cuenta" subtitle="Gratis, sin tarjeta de crédito.">
      <form className="auth-form" onSubmit={handleRegister} data-cy="register-form" noValidate>
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
            className={`form-input`}
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            data-cy="password-input"
            autoComplete="new-password"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="confirm">Confirmar contraseña</label>
          <input
            id="confirm"
            type="password"
            className={`form-input`}
            placeholder="Repite tu contraseña"
            value={confirm}
            onChange={e => { setConfirm(e.target.value); setError('') }}
            data-cy="confirm-input"
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          data-cy="submit-btn"
        >
          {loading ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>

      <p className="auth-footer">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="auth-link" data-cy="go-login">
          Inicia sesión
        </Link>
      </p>
    </AuthLayout>
  )
}
