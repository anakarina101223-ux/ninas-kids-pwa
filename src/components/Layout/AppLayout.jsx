import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import EstadoConexion from '../EstadoConexion'
import './AppLayout.css'

const TITULOS_POR_RUTA = {
  '/': 'Panel',
  '/usuarios': 'Gestión de usuarios',
  '/inventario': 'Inventario',
  '/ventas': 'Ventas',
  '/clientes': 'Clientes',
  '/cuentas-por-cobrar': 'Cuentas por cobrar',
  '/cuadre-caja': 'Cuadre de caja',
  '/reportes': 'Reportes',
}

export default function AppLayout() {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const location = useLocation()
  const titulo = TITULOS_POR_RUTA[location.pathname] ?? 'Panel'

  return (
    <div className="nk-app-shell">
      <EstadoConexion />
      <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
      <div className="nk-app-main">
        <Topbar titulo={titulo} onAbrirMenu={() => setMenuAbierto(true)} />
        <main className="nk-app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}