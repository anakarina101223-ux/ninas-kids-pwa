import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import AbonoModal from '../components/CuentasPorCobrar/AbonoModal'
import NuevaCuentaModal from '../components/CuentasPorCobrar/NuevaCuentaModal'
import './CuentasPorCobrar.css'

export default function CuentasPorCobrar() {
  const [cuentas, setCuentas] = useState([])
  const [clientes, setClientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('pendiente')
  const [filtroCliente, setFiltroCliente] = useState('todos')
  const [cuentaParaAbono, setCuentaParaAbono] = useState(null)
  const [abonos, setAbonos] = useState([])
  const [mostrarNuevaCuenta, setMostrarNuevaCuenta] = useState(false)
  const [cuentaEditando, setCuentaEditando] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [{ data: c, error: e1 }, { data: cl, error: e2 }, { data: ab, error: e3 }] = await Promise.all([
    supabase.from('cuentas_por_cobrar')
        .select('id, venta_id, cliente_id, monto_total, monto_pagado, saldo, estado, fecha_limite, fecha, descripcion')
        .order('fecha', { ascending: false }),
    supabase.from('clientes').select('id, nombre, telefono').order('nombre'),
    supabase.from('abonos').select('id, cuenta_id, monto, metodo_pago, fecha').order('fecha', { ascending: false }),
    ])
    if (e1 || e2 || e3) setError((e1 || e2 || e3).message)
    setCuentas(c ?? [])
    setClientes(cl ?? [])
    setAbonos(ab ?? [])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const nombreCliente = (id) => clientes.find((c) => c.id === id)?.nombre ?? '—'
  const telefonoCliente = (id) => clientes.find((c) => c.id === id)?.telefono

  const cuentasFiltradas = useMemo(() => cuentas.filter((c) => {
    if (filtroEstado !== 'todas' && c.estado !== filtroEstado) return false
    if (filtroCliente !== 'todos' && c.cliente_id !== filtroCliente) return false
    return true
  }), [cuentas, filtroEstado, filtroCliente])

  const totalPendiente = cuentasFiltradas
    .filter((c) => c.estado === 'pendiente')
    .reduce((sum, c) => sum + Number(c.saldo), 0)

  // Agrupado por cliente, para la vista organizada que pediste
  const porCliente = useMemo(() => {
    const grupos = {}
    for (const c of cuentasFiltradas) {
      if (!grupos[c.cliente_id]) grupos[c.cliente_id] = []
      grupos[c.cliente_id].push(c)
    }
    return Object.entries(grupos).sort((a, b) => nombreCliente(a[0]).localeCompare(nombreCliente(b[0])))
  }, [cuentasFiltradas, clientes])

  const METODO_LABEL = { efectivo: 'Efectivo', pago_movil: 'Pago móvil', transferencia: 'Transferencia', tarjeta: 'Tarjeta' }
  const abonosDeCuenta = (cuentaId) => abonos.filter((a) => a.cuenta_id === cuentaId)
  const eliminarCuenta = async (c) => {
    const abonosCuenta = abonosDeCuenta(c.id)
    const totalAbonos = abonosCuenta.reduce((s, a) => s + Number(a.monto), 0)
    const aviso = abonosCuenta.length > 0
      ? `\n\nEsta cuenta tiene ${abonosCuenta.length} abono(s) registrado(s) en el sistema por $${totalAbonos.toFixed(2)}. También se eliminarán, y dejarán de contar en el Cuadre de caja y en los Reportes de los días en que se recibieron.`
      : ''

    if (!confirm(`¿Eliminar la cuenta de ${nombreCliente(c.cliente_id)} por $${Number(c.monto_total).toFixed(2)}?${aviso}\n\nEsta acción no se puede deshacer.`)) return

    const { error } = await supabase.from('cuentas_por_cobrar').delete().eq('id', c.id)
    if (error) setError(error.message)
    else cargar()
  }

  return (
    <div>
      <div className="nk-cxc-header">
        <div>
          <h1>Cuentas por cobrar</h1>
          <p style={{ color: 'var(--nk-ink-soft)', margin: '4px 0 0' }}>
            Total pendiente: <strong style={{ color: 'var(--nk-coral)' }}>${totalPendiente.toFixed(2)}</strong>
          </p>
        </div>
        <button className="nk-btn nk-btn-primary" onClick={() => setMostrarNuevaCuenta(true)}>
          + Nueva cuenta
        </button>
      </div>

      <div className="nk-cxc-filtros">
        <div className="nk-inv-genero-tabs">
          {[['pendiente', 'Pendientes'], ['pagada', 'Pagadas'], ['todas', 'Todas']].map(([v, label]) => (
            <button key={v} className={`nk-inv-genero-tab ${filtroEstado === v ? 'nk-inv-genero-tab-activo' : ''}`} onClick={() => setFiltroEstado(v)}>
              {label}
            </button>
          ))}
        </div>
        <select value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}>
          <option value="todos">Todos los clientes</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {error && <p className="nk-error-text" role="alert" style={{ margin: '12px 0' }}>{error}</p>}

      {cargando ? (
        <p style={{ color: 'var(--nk-ink-soft)' }}>Cargando cuentas…</p>
      ) : porCliente.length === 0 ? (
        <p style={{ color: 'var(--nk-ink-faint)', textAlign: 'center', padding: 40 }}>No hay cuentas que coincidan con el filtro.</p>
      ) : (
        <div className="nk-cxc-grupos">
          {porCliente.map(([clienteId, cuentasCliente]) => {
            const saldoCliente = cuentasCliente.filter((c) => c.estado === 'pendiente').reduce((s, c) => s + Number(c.saldo), 0)
            return (
              <div key={clienteId} className="nk-card nk-cxc-grupo">
                <div className="nk-cxc-grupo-header">
                  <div>
                    <h3>{nombreCliente(clienteId)}</h3>
                    {telefonoCliente(clienteId) && <p className="nk-inv-card-meta">{telefonoCliente(clienteId)}</p>}
                  </div>
                  {saldoCliente > 0 && <span className="nk-chip nk-chip-coral">Debe ${saldoCliente.toFixed(2)}</span>}
                </div>
                <hr className="nk-stitch" style={{ margin: '10px 0' }} />
                <div className="nk-cxc-lista">
                  {cuentasCliente.map((c) => (
                    <div key={c.id} className="nk-cxc-item-wrap">
                        <div className="nk-cxc-item">
                        <div>
                          <span className="nk-inv-card-meta">{new Date(c.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          {c.fecha_limite && <span className="nk-inv-card-meta"> · vence {new Date(c.fecha_limite).toLocaleDateString('es-VE')}</span>}
                          {!c.venta_id && <span className="nk-chip nk-chip-marigold" style={{ marginLeft: 8 }}>Manual</span>}
                          {c.descripcion && <div className="nk-cxc-descripcion">{c.descripcion}</div>}
                        </div>
                        <div className="nk-cxc-item-montos">
                            <span>${Number(c.monto_total).toFixed(2)} total</span>
                            <span style={{ color: 'var(--nk-ink-soft)' }}>${Number(c.monto_pagado).toFixed(2)} abonado</span>
                            <span style={{ fontWeight: 700 }}>${Number(c.saldo).toFixed(2)} saldo</span>
                        </div>
                        <span className={`nk-chip ${c.estado === 'pagada' ? 'nk-chip-green' : 'nk-chip-coral'}`}>
                            {c.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
                        </span>
                        <div className="nk-cxc-item-acciones">
                          {c.estado === 'pendiente' && (
                            <button className="nk-btn nk-btn-primary" onClick={() => setCuentaParaAbono(c)}>Registrar abono</button>
                          )}
                          {!c.venta_id && (
                            <>
                              <button className="nk-btn nk-btn-ghost" onClick={() => setCuentaEditando(c)}>Editar</button>
                              <button className="nk-btn nk-btn-danger" onClick={() => eliminarCuenta(c)}>Eliminar</button>
                            </>
                          )}
                        </div>
                        </div>

                        {abonosDeCuenta(c.id).length > 0 && (
                        <div className="nk-cxc-abonos">
                            {abonosDeCuenta(c.id).map((a) => (
                            <div key={a.id} className="nk-cxc-abono">
                                <span>{new Date(a.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="nk-chip nk-chip-teal">{METODO_LABEL[a.metodo_pago]}</span>
                                <span className="nk-cxc-abono-monto">${Number(a.monto).toFixed(2)}</span>
                            </div>
                            ))}
                        </div>
                        )}
                    </div>

                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {cuentaParaAbono && (
        <AbonoModal
          cuenta={cuentaParaAbono}
          cliente={nombreCliente(cuentaParaAbono.cliente_id)}
          onCerrar={() => setCuentaParaAbono(null)}
          onGuardado={() => { setCuentaParaAbono(null); cargar() }}
        />
      )}

      {(mostrarNuevaCuenta || cuentaEditando) && (
        <NuevaCuentaModal
          clientes={clientes}
          cuenta={cuentaEditando}
          abonosCuenta={cuentaEditando ? abonosDeCuenta(cuentaEditando.id) : []}
          onCerrar={() => { setMostrarNuevaCuenta(false); setCuentaEditando(null) }}
          onGuardado={() => { setMostrarNuevaCuenta(false); setCuentaEditando(null); cargar() }}
        />
      )}
    </div>
  )
}