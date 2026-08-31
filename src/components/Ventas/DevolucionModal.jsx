import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function DevolucionModal({ venta, onCerrar, onGuardado }) {
  const [itemsVenta, setItemsVenta] = useState([])
  const [seleccion, setSeleccion] = useState({}) // { producto_id: { cantidad, regresa_a_stock } }
  const [motivo, setMotivo] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('venta_items')
      .select('producto_id, cantidad, precio_unitario, productos(nombre, talla, stock_actual)')
      .eq('venta_id', venta.id)
      .then(({ data }) => { setItemsVenta(data ?? []); setCargando(false) })
  }, [venta.id])

  const toggleItem = (item, activo) => {
    setSeleccion((prev) => {
      const copia = { ...prev }
      if (!activo) { delete copia[item.producto_id]; return copia }
      copia[item.producto_id] = { cantidad: item.cantidad, regresa_a_stock: true }
      return copia
    })
  }

  const actualizarCampo = (productoId, campo, valor) => {
    setSeleccion((prev) => ({ ...prev, [productoId]: { ...prev[productoId], [campo]: valor } }))
  }

  const seleccionados = itemsVenta.filter((i) => seleccion[i.producto_id])
  const montoTotal = seleccionados.reduce((sum, i) => sum + (i.precio_unitario * seleccion[i.producto_id].cantidad), 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (seleccionados.length === 0) { setError('Selecciona al menos un producto a devolver.'); return }

    setGuardando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data: devolucion, error: devError } = await supabase.from('devoluciones')
        .insert({ venta_id: venta.id, cliente_id: venta.cliente_id, motivo: motivo || null, monto_total: montoTotal, usuario_id: user.id })
        .select().single()
      if (devError) throw devError

      const filas = seleccionados.map((i) => ({
        devolucion_id: devolucion.id,
        producto_id: i.producto_id,
        cantidad: seleccion[i.producto_id].cantidad,
        regresa_a_stock: seleccion[i.producto_id].regresa_a_stock,
        subtotal: i.precio_unitario * seleccion[i.producto_id].cantidad,
      }))
      const { error: itemsError } = await supabase.from('devolucion_items').insert(filas)
      if (itemsError) throw itemsError

      // Regresar al stock los productos marcados, y dejar registro del movimiento
      for (const i of seleccionados) {
        const sel = seleccion[i.producto_id]
        if (sel.regresa_a_stock) {
          await supabase.from('productos')
            .update({ stock_actual: i.productos.stock_actual + sel.cantidad, actualizado_en: new Date().toISOString() })
            .eq('id', i.producto_id)
          await supabase.from('movimientos_inventario')
            .insert({ producto_id: i.producto_id, tipo: 'entrada', cantidad: sel.cantidad, motivo: 'Devolución', usuario_id: user.id })
        }
      }

      // Nota de crédito a favor del cliente
      const { error: notaError } = await supabase.from('notas_credito')
        .insert({ cliente_id: venta.cliente_id, devolucion_id: devolucion.id, monto: montoTotal, saldo_disponible: montoTotal })
      if (notaError) throw notaError

      // Reflejar en la venta original cuánto se devolvió
      const { error: ventaError } = await supabase.from('ventas')
        .update({ total_devuelto: Number(venta.total_devuelto ?? 0) + montoTotal })
        .eq('id', venta.id)
      if (ventaError) throw ventaError

      onGuardado()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="nk-modal-overlay" onClick={onCerrar}>
      <div className="nk-modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <h2>Registrar devolución</h2>
        <p style={{ color: 'var(--nk-ink-soft)', margin: '4px 0 20px' }}>
          Se generará una nota de crédito a favor del cliente por el monto devuelto.
        </p>

        {cargando ? (
          <p style={{ color: 'var(--nk-ink-soft)' }}>Cargando productos de la venta…</p>
        ) : (
          <form onSubmit={handleSubmit} className="nk-producto-form">
            <div className="nk-devolucion-items">
              {itemsVenta.map((i) => {
                const activo = Boolean(seleccion[i.producto_id])
                return (
                  <div key={i.producto_id} className="nk-devolucion-item">
                    <label className="nk-devolucion-item-check">
                      <input type="checkbox" checked={activo} onChange={(e) => toggleItem(i, e.target.checked)} />
                      {i.productos.nombre} {i.productos.talla && `· ${i.productos.talla}`}
                      <span className="nk-devolucion-item-precio">${Number(i.precio_unitario).toFixed(2)} c/u</span>
                    </label>

                    {activo && (
                      <div className="nk-devolucion-item-detalle">
                        <div className="nk-field">
                          <label>Cantidad a devolver (máx. {i.cantidad})</label>
                          <input
                            type="number" min="1" max={i.cantidad}
                            value={seleccion[i.producto_id].cantidad}
                            onChange={(e) => actualizarCampo(i.producto_id, 'cantidad', Math.max(1, Math.min(i.cantidad, Number(e.target.value))))}
                          />
                        </div>
                        <label className="nk-devolucion-item-check">
                          <input
                            type="checkbox"
                            checked={seleccion[i.producto_id].regresa_a_stock}
                            onChange={(e) => actualizarCampo(i.producto_id, 'regresa_a_stock', e.target.checked)}
                          />
                          Regresa al inventario (reutilizable)
                        </label>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="nk-field">
              <label>Motivo (opcional)</label>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: talla incorrecta, producto dañado…" />
            </div>

            <div className="nk-venta-total">
              <span>Nota de crédito a generar</span>
              <span>${montoTotal.toFixed(2)}</span>
            </div>

            {error && <p className="nk-error-text" role="alert">{error}</p>}

            <div className="nk-producto-form-actions">
              <button type="button" className="nk-btn nk-btn-ghost" onClick={onCerrar}>Cancelar</button>
              <button type="submit" className="nk-btn nk-btn-primary" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Confirmar devolución'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}