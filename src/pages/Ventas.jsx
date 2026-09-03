import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import NuevaVentaModal from '../components/Ventas/NuevaVentaModal'
import DevolucionModal from '../components/Ventas/DevolucionModal'
import './Ventas.css'

const METODO_LABEL = { efectivo: 'Efectivo', pm_transferencia: 'PM / Transferencia', usdt: 'USDT', tarjeta: 'Tarjeta', mixto: 'Mixto' }

export default function Ventas() {
  const [ventas, setVentas] = useState([])
  const [clientes, setClientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mostrarNueva, setMostrarNueva] = useState(false)
  const [ventaParaDevolucion, setVentaParaDevolucion] = useState(null)
  const [filtroCliente, setFiltroCliente] = useState('todos')

  const cargar = useCallback(async () => {
    setCargando(true)
    const [{ data: v, error: e1 }, { data: c, error: e2 }] = await Promise.all([
      supabase.from('ventas').select('id, fecha, total, total_devuelto, metodo_pago, estado, cliente_id').order('fecha', { ascending: false }),
      supabase.from('clientes').select('id, nombre').order('nombre'),
    ])
    if (e1 || e2) setError((e1 || e2).message)
    setVentas(v ?? [])
    setClientes(c ?? [])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const nombreCliente = (id) => clientes.find((c) => c.id === id)?.nombre ?? '—'

  const ventasFiltradas = filtroCliente === 'todos'
    ? ventas
    : ventas.filter((v) => v.cliente_id === filtroCliente)

  const totalPeriodo = ventasFiltradas.reduce((sum, v) => sum + Number(v.total), 0)

  return (
    <div>
      <div className="nk-ventas-header">
        <div>
          <h1>Ventas</h1>
          <p style={{ color: 'var(--nk-ink-soft)', margin: '4px 0 0' }}>
            {ventasFiltradas.length} venta{ventasFiltradas.length !== 1 && 's'} · Total: ${totalPeriodo.toFixed(2)}
          </p>
        </div>
        <button className="nk-btn nk-btn-primary" onClick={() => setMostrarNueva(true)}>+ Registrar venta</button>
      </div>

      <select className="nk-ventas-filtro-cliente" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}>
        <option value="todos">Todos los clientes</option>
        {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>

      {error && <p className="nk-error-text" role="alert" style={{ margin: '12px 0' }}>{error}</p>}

      <div className="nk-card nk-ventas-table-wrap">
        {cargando ? (
          <p style={{ padding: 24, color: 'var(--nk-ink-soft)' }}>Cargando ventas…</p>
        ) : (
          <table className="nk-clientes-table">
            <thead>
              <tr><th>Fecha</th><th>Cliente</th><th>Método</th><th>Estado</th><th>Total</th><th></th></tr>
            </thead>
            <tbody>
              {ventasFiltradas.map((v) => (
                <tr key={v.id}>
                  <td>{new Date(v.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>{nombreCliente(v.cliente_id)}</td>
                  <td>{METODO_LABEL[v.metodo_pago]}</td>
                  <td>
                    <span className={`nk-chip ${v.estado === 'pagada' ? 'nk-chip-green' : 'nk-chip-coral'}`}>
                      {v.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="nk-users-mono">
                        ${(Number(v.total) - Number(v.total_devuelto ?? 0)).toFixed(2)}
                        {v.total_devuelto > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--nk-coral)' }}>−${Number(v.total_devuelto).toFixed(2)} devuelto</div>
                        )}
                    </td>
                    <td>
                        <button className="nk-btn nk-btn-ghost" onClick={() => setVentaParaDevolucion(v)}>Devolver</button>
                    </td>
                </tr>
              ))}
              {ventasFiltradas.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--nk-ink-faint)' }}>
                  No hay ventas registradas todavía.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {mostrarNueva && (
        <NuevaVentaModal
          clientes={clientes}
          onCerrar={() => setMostrarNueva(false)}
          onGuardado={() => { setMostrarNueva(false); cargar() }}
        />
      )}
      
      {ventaParaDevolucion && (
        <DevolucionModal
            venta={ventaParaDevolucion}
            onCerrar={() => setVentaParaDevolucion(null)}
            onGuardado={() => { setVentaParaDevolucion(null); cargar() }}
        />
      )}


    </div>
  )
}