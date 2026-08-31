import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function MovimientoStockModal({ producto, onCerrar, onGuardado }) {
  const [tipo, setTipo] = useState('entrada')
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const cant = Number(cantidad)
    if (!cant || cant <= 0) { setError('La cantidad debe ser mayor a 0.'); return }

    setGuardando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const nuevoStock = tipo === 'entrada'
        ? producto.stock_actual + cant
        : tipo === 'salida'
          ? producto.stock_actual - cant
          : cant // ajuste = valor absoluto nuevo

      if (nuevoStock < 0) { setError('El stock no puede quedar negativo.'); setGuardando(false); return }

      const { error: movError } = await supabase.from('movimientos_inventario').insert({
        producto_id: producto.id, tipo, cantidad: cant, motivo: motivo || null, usuario_id: user.id,
      })
      if (movError) throw movError

      const { error: prodError } = await supabase.from('productos')
        .update({ stock_actual: nuevoStock, actualizado_en: new Date().toISOString() })
        .eq('id', producto.id)
      if (prodError) throw prodError

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
        <h2>Ajustar stock</h2>
        <p style={{ color: 'var(--nk-ink-soft)', margin: '4px 0 20px' }}>
          {producto.nombre} — stock actual: <strong>{producto.stock_actual}</strong>
        </p>

        <form onSubmit={handleSubmit} className="nk-producto-form">
          <div className="nk-field">
            <label>Tipo de movimiento</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="entrada">Entrada (sumar)</option>
              <option value="salida">Salida (restar)</option>
              <option value="ajuste">Ajuste (fijar valor exacto)</option>
            </select>
          </div>

          <div className="nk-field">
            <label>{tipo === 'ajuste' ? 'Nuevo valor de stock' : 'Cantidad'}</label>
            <input required type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </div>

          <div className="nk-field">
            <label>Motivo (opcional)</label>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: mercancía nueva, venta local, conteo físico…" />
          </div>

          {error && <p className="nk-error-text" role="alert">{error}</p>}

          <div className="nk-producto-form-actions">
            <button type="button" className="nk-btn nk-btn-ghost" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="nk-btn nk-btn-primary" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}