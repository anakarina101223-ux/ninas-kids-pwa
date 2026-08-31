import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabaseClient'

export default function Dashboard() {
  const { perfil } = useAuth()
  const [cargando, setCargando] = useState(true)
  const [ventasHoy, setVentasHoy] = useState({ total: 0, cantidad: 0 })
  const [stockBajo, setStockBajo] = useState([])
  const [porCobrar, setPorCobrar] = useState({ total: 0, cantidad: 0 })

  const cargar = useCallback(async () => {
    setCargando(true)
    const hoy = new Date().toLocaleDateString('en-CA')
    const inicioDia = `${hoy}T00:00:00`
    const finDia = `${hoy}T23:59:59`

    const [{ data: ventas }, { data: productos }, { data: cxc }] = await Promise.all([
      supabase.from('ventas').select('total, total_devuelto').gte('fecha', inicioDia).lte('fecha', finDia),
      supabase.from('productos').select('id, nombre, stock_actual, stock_minimo').eq('activo', true),
      supabase.from('cuentas_por_cobrar').select('saldo').eq('estado', 'pendiente'),
    ])

    const totalHoy = (ventas ?? []).reduce((s, v) => s + (Number(v.total) - Number(v.total_devuelto ?? 0)), 0)
    setVentasHoy({ total: totalHoy, cantidad: (ventas ?? []).length })

    setStockBajo((productos ?? []).filter((p) => p.stock_actual <= p.stock_minimo))

    const totalPorCobrar = (cxc ?? []).reduce((s, c) => s + Number(c.saldo), 0)
    setPorCobrar({ total: totalPorCobrar, cantidad: (cxc ?? []).length })

    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return (
    <div>
      <p style={{ color: 'var(--nk-ink-soft)', marginBottom: 4 }}>Hola, {perfil?.nombre?.split(' ')[0]} 👋</p>
      <h1 style={{ marginBottom: 20 }}>Panel general</h1>

      {cargando ? (
        <p style={{ color: 'var(--nk-ink-soft)' }}>Cargando…</p>
      ) : (
        <>
          <div className="nk-dashboard-stats">
            <Link to="/ventas" className="nk-card nk-dashboard-stat">
              <span className="nk-inv-card-meta">Ventas de hoy</span>
              <strong>${ventasHoy.total.toFixed(2)}</strong>
              <span className="nk-inv-card-meta">{ventasHoy.cantidad} venta{ventasHoy.cantidad !== 1 && 's'}</span>
            </Link>

            <Link to="/cuentas-por-cobrar" className="nk-card nk-dashboard-stat">
              <span className="nk-inv-card-meta">Por cobrar</span>
              <strong style={{ color: porCobrar.total > 0 ? 'var(--nk-coral)' : undefined }}>${porCobrar.total.toFixed(2)}</strong>
              <span className="nk-inv-card-meta">{porCobrar.cantidad} cuenta{porCobrar.cantidad !== 1 && 's'} pendiente{porCobrar.cantidad !== 1 && 's'}</span>
            </Link>

            <Link to="/inventario" className="nk-card nk-dashboard-stat">
              <span className="nk-inv-card-meta">Stock bajo</span>
              <strong style={{ color: stockBajo.length > 0 ? 'var(--nk-marigold)' : undefined }}>{stockBajo.length}</strong>
              <span className="nk-inv-card-meta">producto{stockBajo.length !== 1 && 's'} por reponer</span>
            </Link>
          </div>

          {stockBajo.length > 0 && (
            <div className="nk-card nk-dashboard-alerta">
              <h3>Productos con stock bajo</h3>
              <hr className="nk-stitch" style={{ margin: '10px 0' }} />
              <div className="nk-dashboard-lista">
                {stockBajo.slice(0, 6).map((p) => (
                  <div key={p.id} className="nk-cuadre-linea">
                    <span>{p.nombre}</span>
                    <span className="nk-chip nk-chip-coral">{p.stock_actual} unid.</span>
                  </div>
                ))}
              </div>
              {stockBajo.length > 6 && (
                <p className="nk-inv-card-meta" style={{ marginTop: 8 }}>
                  y {stockBajo.length - 6} producto{stockBajo.length - 6 !== 1 && 's'} más — <Link to="/inventario">ver inventario completo</Link>
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}