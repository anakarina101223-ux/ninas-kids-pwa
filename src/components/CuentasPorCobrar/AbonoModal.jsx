import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function AbonoModal({ cuenta, cliente, onCerrar, onGuardado }) {
  const [monto, setMonto] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const montoNum = Number(monto)
    if (!montoNum || montoNum <= 0) { setError('Ingresa un monto válido.'); return }
    if (montoNum > Number(cuenta.saldo)) { setError(`El monto no puede superar el saldo pendiente ($${Number(cuenta.saldo).toFixed(2)}).`); return }

    setGuardando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { error: abonoError } = await supabase.from('abonos')
        .insert({ cuenta_id: cuenta.id, monto: montoNum, metodo_pago: metodoPago, usuario_id: user.id })
      if (abonoError) throw abonoError

      const nuevoMontoPagado = Number(cuenta.monto_pagado) + montoNum
      const nuevoEstado = nuevoMontoPagado >= Number(cuenta.monto_total) ? 'pagada' : 'pendiente'

      const { error: cuentaError } = await supabase.from('cuentas_por_cobrar')
        .update({ monto_pagado: nuevoMontoPagado, estado: nuevoEstado })
        .eq('id', cuenta.id)
      if (cuentaError) throw cuentaError

      // Si con este abono queda saldada, reflejarlo también en la venta original
      if (nuevoEstado === 'pagada' && cuenta.venta_id) {
        await supabase.from('ventas').update({ estado: 'pagada' }).eq('id', cuenta.venta_id)
      }

      onGuardado()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="nk-modal-overlay" onClick={onCerrar}>
      <div className="nk-modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <h2>Registrar abono</h2>
        <p style={{ color: 'var(--nk-ink-soft)', margin: '4px 0 20px' }}>
          {cliente} — saldo pendiente: <strong>${Number(cuenta.saldo).toFixed(2)}</strong>
        </p>

        <form onSubmit={handleSubmit} className="nk-producto-form">
          <div className="nk-field">
            <label>Monto del abono</label>
            <input required type="number" step="0.01" min="0.01" max={cuenta.saldo} value={monto} onChange={(e) => setMonto(e.target.value)} />
          </div>
          <div className="nk-field">
            <label>Método de pago</label>
            <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="pm_transferencia">PM / Transferencia</option>
              <option value="usdt">USDT</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>

          {error && <p className="nk-error-text" role="alert">{error}</p>}

          <div className="nk-producto-form-actions">
            <button type="button" className="nk-btn nk-btn-ghost" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="nk-btn nk-btn-primary" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Confirmar abono'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}