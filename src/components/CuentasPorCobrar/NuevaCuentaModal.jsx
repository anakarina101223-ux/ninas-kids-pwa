import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const NUEVO = '__nuevo__'
const redondear = (n) => Math.round(n * 100) / 100

export default function NuevaCuentaModal({ clientes, cuenta = null, abonosCuenta = [], onCerrar, onGuardado }) {
  const esEdicion = Boolean(cuenta)

  // Abonos hechos desde el sistema (se conservan al editar)
  const totalAbonosSistema = redondear(abonosCuenta.reduce((s, a) => s + Number(a.monto), 0))
  // Lo abonado "antes del sistema" = lo pagado menos los abonos registrados aquí
  const previoInicial = esEdicion
    ? Math.max(0, redondear(Number(cuenta.monto_pagado) - totalAbonosSistema))
    : ''

  const [clienteId, setClienteId] = useState(cuenta?.cliente_id ?? '')
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [telefonoNuevo, setTelefonoNuevo] = useState('')
  const [fecha, setFecha] = useState(
    new Date(cuenta?.fecha ?? Date.now()).toLocaleDateString('en-CA')
  )
  const [descripcion, setDescripcion] = useState(cuenta?.descripcion ?? '')
  const [montoTotal, setMontoTotal] = useState(cuenta ? cuenta.monto_total : '')
  const [abonadoPrevio, setAbonadoPrevio] = useState(previoInicial)
  const [fechaLimite, setFechaLimite] = useState(cuenta?.fecha_limite ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const esNuevo = clienteId === NUEVO
  const total = Number(montoTotal) || 0
  const abonado = Number(abonadoPrevio) || 0
  const pagado = abonado + totalAbonosSistema
  const saldo = total - pagado

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!clienteId) { setError('Selecciona un cliente.'); return }
    if (esNuevo && !nombreNuevo.trim()) { setError('Escribe el nombre del cliente nuevo.'); return }
    if (total <= 0) { setError('El monto total debe ser mayor a 0.'); return }
    if (abonado < 0) { setError('Lo abonado no puede ser negativo.'); return }
    if (!esEdicion && abonado >= total) {
      setError('Lo abonado debe ser menor al monto total (una cuenta ya pagada por completo no hace falta registrarla).')
      return
    }
    if (esEdicion && pagado > total) {
      setError(`Lo pagado hasta ahora ($${pagado.toFixed(2)}) supera el monto total. Corrige el total o lo abonado antes.`)
      return
    }

    setGuardando(true)
    try {
      let idCliente = clienteId
      if (esNuevo) {
        const { data: nuevo, error: errCliente } = await supabase.from('clientes')
          .insert({ nombre: nombreNuevo.trim(), telefono: telefonoNuevo.trim() || null })
          .select('id').single()
        if (errCliente) throw errCliente
        idCliente = nuevo.id
      }

      const montoPagado = redondear(pagado)
      const payload = {
        cliente_id: idCliente,
        monto_total: total,
        monto_pagado: montoPagado,
        estado: montoPagado >= total ? 'pagada' : 'pendiente',
        descripcion: descripcion.trim() || null,
        fecha: `${fecha}T12:00:00`,
        fecha_limite: fechaLimite || null,
      }

      const { error: errCuenta } = esEdicion
        ? await supabase.from('cuentas_por_cobrar').update(payload).eq('id', cuenta.id)
        : await supabase.from('cuentas_por_cobrar').insert({ venta_id: null, ...payload })
      if (errCuenta) throw errCuenta

      onGuardado()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="nk-modal-overlay" onClick={onCerrar}>
      <div className="nk-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <h2>{esEdicion ? 'Editar cuenta por cobrar' : 'Nueva cuenta por cobrar'}</h2>
        <p style={{ color: 'var(--nk-ink-soft)', margin: '4px 0 0' }}>
          {esEdicion
            ? 'Los abonos ya registrados en el sistema se conservan.'
            : 'Para registrar una deuda que no viene de una venta del sistema.'}
        </p>
        <hr className="nk-stitch" style={{ margin: '12px 0 20px' }} />

        <form onSubmit={handleSubmit} className="nk-producto-form">
          <div className="nk-field">
            <label>Cliente</label>
            <select required value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="" disabled>Selecciona un cliente</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              <option value={NUEVO}>Agregar cliente…</option>
            </select>
          </div>

          {esNuevo && (
            <div className="nk-producto-form-row">
              <div className="nk-field">
                <label>Nombre del cliente</label>
                <input value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} />
              </div>
              <div className="nk-field">
                <label>Teléfono (opcional)</label>
                <input value={telefonoNuevo} onChange={(e) => setTelefonoNuevo(e.target.value)} />
              </div>
            </div>
          )}

          <div className="nk-field">
            <label>Detalle / prendas (opcional)</label>
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: 2 conjuntos oversize talla 10 + 1 jean"
            />
          </div>

          <div className="nk-producto-form-row">
            <div className="nk-field">
              <label>Fecha de la cuenta</label>
              <input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="nk-field">
              <label>Fecha límite (opcional)</label>
              <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} />
            </div>
          </div>

          <div className="nk-producto-form-row">
            <div className="nk-field">
              <label>Monto total ($)</label>
              <input required type="number" step="0.01" min="0.01" value={montoTotal}
                onChange={(e) => setMontoTotal(e.target.value)} />
            </div>
            <div className="nk-field">
              <label>{esEdicion ? 'Abonado antes del sistema ($)' : 'Ya abonado antes ($)'}</label>
              <input type="number" step="0.01" min="0" value={abonadoPrevio}
                onChange={(e) => setAbonadoPrevio(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="nk-producto-resumen">
            {totalAbonosSistema > 0 && (
              <div className="nk-cuadre-linea">
                <span>Abonos registrados en el sistema</span>
                <span>${totalAbonosSistema.toFixed(2)}</span>
              </div>
            )}
            <div className="nk-cuadre-linea nk-cuadre-linea-total">
              <span>Saldo pendiente</span>
              <span>${saldo > 0 ? saldo.toFixed(2) : '0.00'}</span>
            </div>
          </div>

          {error && <p className="nk-error-text" role="alert">{error}</p>}

          <div className="nk-producto-form-actions">
            <button type="button" className="nk-btn nk-btn-ghost" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="nk-btn nk-btn-primary" disabled={guardando}>
              {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Registrar cuenta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}