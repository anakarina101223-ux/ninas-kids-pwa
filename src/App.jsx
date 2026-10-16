import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import AppLayout from './components/Layout/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UsersManagement from './pages/UsersManagement'
import Inventario from './pages/Inventario'
import Clientes from './pages/Clientes'
import Ventas from './pages/Ventas'
import CuentasPorCobrar from './pages/CuentasPorCobrar'
import CuadreCaja from './pages/CuadreCaja'
import Reportes from './pages/Reportes'
import Banco from './pages/Banco'
import Gastos from './pages/Gastos'
import { ThemeProvider } from './themes/ThemeContext'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />}  />
              <Route path="inventario" element={<Inventario />} />
              <Route path="clientes" element={<Clientes />} />
              <Route path="ventas" element={<Ventas />} />
              <Route path="cuentas-por-cobrar" element={<CuentasPorCobrar />} />
              <Route path="cuadre-caja" element={<CuadreCaja />} />
              <Route path="reportes" element={<Reportes />} />
              <Route path="banco" element={<Banco />} />
              <Route path="gastos" element={<Gastos />} />
              <Route
                path="usuarios"
                element={
                  <ProtectedRoute soloSuperAdmin>
                    <UsersManagement />
                  </ProtectedRoute>
                }
              />
              {/* Inventario, Ventas, Clientes, Cuentas por cobrar, Cuadre de caja
                  y Reportes se agregan en las siguientes fases */}
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}