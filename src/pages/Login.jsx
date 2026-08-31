import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import './Login.css'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setEnviando(true)
    const { error } = await login(correo, contrasena)
    setEnviando(false)
    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Correo o contraseña incorrectos.'
        : error.message)
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <div className="nk-login-screen">
      <div className="nk-login-tag">
        <div className="nk-login-tag-hole" />

        <div className="nk-login-brand">
          <span className="nk-login-eyebrow">Sistema de gestión</span>
          <img src="/logo-ninas-kids.png" alt="Nina's Kids" className="nk-login-logo" />
        </div>

        <hr className="nk-stitch" style={{ margin: '20px 0 24px' }} />

        <form onSubmit={handleSubmit} className="nk-login-form">
          <div className="nk-field">
            <label htmlFor="correo">Correo</label>
            <input
              id="correo"
              type="email"
              autoComplete="username"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
              placeholder="tucorreo@ejemplo.com"
            />
          </div>

          <div className="nk-field">
            <label htmlFor="contrasena">Contraseña</label>
            <input
              id="contrasena"
              type="password"
              autoComplete="current-password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          {error && <p className="nk-error-text" role="alert">{error}</p>}

          <button type="submit" className="nk-btn nk-btn-primary" disabled={enviando} style={{ marginTop: 8 }}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>

      <p className="nk-login-footer">Acceso restringido al personal autorizado</p>
    </div>
  )
}