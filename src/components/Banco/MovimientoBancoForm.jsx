import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function MovimientoBancoForm({ movimiento, onCerrar, onGuardado }) {
  const esEdicion = Boolean(movimiento)
  const [fecha, setFecha] = useState(movimiento?.fecha ?? new Date().toLocaleDateString('en-CA'))
  const [descripcion, setDescripcion] = useState(movimiento?.descripcion ?? '')
  const [tipo, setTipo] = useState(movimiento ? (Number(movimiento.debe) > 0 ? 'debe' : 'haber') : 'debe')
  const [monto, setMonto] = useState(movimiento ? (Number(movimiento.debe) || Number(movimiento.haber)) : '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const montoNum = Number(monto)
    if (!montoNum || montoNum <= 0) { setError('Ingresa un monto válido.'); return }

    setGuardando(true)
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      fecha,
      descripcion,
      debe: tipo === 'debe' ? montoNum : 0,
      haber: tipo === 'haber' ? montoNum : 0,
      usuario_id: user.id,
    }

    const { error } = esEdicion
      ? await supabase.from('movimientos_banco').update(payload).eq('id', movimiento.id)
      : await supabase.from('movimientos_banco').insert(payload)

    setGuardando(false)
    if (error) { setError(error.message); return }
    onGuardado()
  }

  return (
    <div className="nk-modal-overlay" onClick={onCerrar}>
      <div className="nk-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <h2>{esEdicion ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
        <hr className="nk-stitch" style={{ margin: '12px 0 20px' }} />

        <form onSubmit={handleSubmit} className="nk-producto-form">
          <div className="nk-field">
            <label>Fecha</label>
            <input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          <div className="nk-field">
            <label>Descripción</label>
            <input required value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Venta 166$, Compra 50$ tasa 850 efectivo, Comisión…" />
          </div>

          <div className="nk-producto-form-row">
            <div className="nk-field">
              <label>Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="debe">Debe (entra dinero)</option>
                <option value="haber">Haber (sale dinero)</option>
              </select>
            </div>
            <div className="nk-field">
              <label>Monto</label>
              <input required type="number" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
            </div>
          </div>

          {error && <p className="nk-error-text" role="alert">{error}</p>}

          <div className="nk-producto-form-actions">
            <button type="button" className="nk-btn nk-btn-ghost" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="nk-btn nk-btn-primary" disabled={guardando}>
              {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Registrar movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}