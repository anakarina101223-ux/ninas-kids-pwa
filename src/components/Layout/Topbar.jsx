import { useAuth } from '../../auth/AuthContext'
import './Topbar.css'

export default function Topbar({ titulo, onAbrirMenu }) {
  const { logout } = useAuth()

  return (
    <header className="nk-topbar">
      <button className="nk-topbar-menu-btn" onClick={onAbrirMenu} aria-label="Abrir menú">
        ☰
      </button>
      <h2 className="nk-topbar-title">{titulo}</h2>
      <button className="nk-btn nk-btn-ghost" onClick={logout}>
        Cerrar sesión
      </button>
    </header>
  )
}