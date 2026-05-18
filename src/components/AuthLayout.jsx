import './AuthLayout.css'

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="auth-bg">
      <div className="auth-deco" aria-hidden="true">
        <span>T</span><span>F</span>
      </div>
      <div className="auth-card">
        <div className="auth-brand" data-cy="auth-brand">
          <div className="auth-dot" />
          <span>TaskFlow</span>
        </div>
        <h1 className="auth-title" data-cy="auth-title">{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}
