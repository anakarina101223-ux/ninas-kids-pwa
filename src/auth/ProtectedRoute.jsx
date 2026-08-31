import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function ProtectedRoute({ children, soloSuperAdmin = false }) {
  const { session, rol, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: 'var(--nk-ink-soft)' }}>
        Cargando…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (soloSuperAdmin && rol !== 'super_admin') {
    return <Navigate to="/" replace />
  }

  return children
}