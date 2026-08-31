import { NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import { useTheme } from '../../themes/ThemeContext'
import './Sidebar.css'

const NAV_ITEMS = [
  { to: '/', label: 'Panel', icon: '⌂', end: true },
  { to: '/inventario', label: 'Inventario', icon: '👕' },
  { to: '/ventas', label: 'Ventas', icon: '🧾' },
  { to: '/clientes', label: 'Clientes', icon: '👥' },
  { to: '/cuentas-por-cobrar', label: 'Cuentas por cobrar', icon: '💳' },
  { to: '/cuadre-caja', label: 'Cuadre de caja', icon: '🗃' },
  { to: '/reportes', label: 'Reportes', icon: '📊' },
]

export default function Sidebar({ abierto, onCerrar }) {
  const { esSuperAdmin, perfil } = useAuth()
  const { tema, alternarTema } = useTheme()
  const { instalable, instalar } = useInstallPrompt()

  return (
    <>
      {abierto && <div className="nk-sidebar-overlay" onClick={onCerrar} />}
      <aside className={`nk-sidebar ${abierto ? 'nk-sidebar-abierto' : ''}`}>
        <div className="nk-sidebar-brand">
            <img
              src={tema === 'claro' ? '/logo-ninas-kids.png' : '/logo-ninas-kids-dark.png'}
              alt="Nina's Kids"
              className="nk-sidebar-logo"
            />
        </div>

        <hr className="nk-stitch" />

        <nav className="nk-sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onCerrar}
              className={({ isActive }) => `nk-sidebar-link ${isActive ? 'nk-sidebar-link-activo' : ''}`}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          {esSuperAdmin && (
            <>
              <hr className="nk-stitch" style={{ margin: '12px 0' }} />
              <NavLink
                to="/usuarios"
                onClick={onCerrar}
                className={({ isActive }) => `nk-sidebar-link ${isActive ? 'nk-sidebar-link-activo' : ''}`}
              >
                <span aria-hidden="true">🔑</span>
                Gestión de usuarios
              </NavLink>
            </>
          )}
        </nav>

        {instalable && (
          <button className="nk-btn nk-btn-primary" style={{ margin: '0 8px 8px' }} onClick={instalar}>
            📲 Instalar app
          </button>
        )}

        <button className="nk-btn nk-btn-ghost nk-tema-toggle" onClick={alternarTema}>
          {tema === 'claro' ? '🌙 Modo oscuro' : '☀️ Modo claro'}
        </button>

        <div className="nk-sidebar-footer">
          <span className="nk-chip nk-chip-teal">
            {esSuperAdmin ? 'Super admin' : 'Gerente'}
          </span>
          <span className="nk-sidebar-user">{perfil?.nombre}</span>
        </div>
      </aside>
    </>
  )
}