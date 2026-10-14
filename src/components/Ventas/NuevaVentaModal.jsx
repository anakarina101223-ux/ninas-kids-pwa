import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
const NUEVO = '__nuevo__'

export default function NuevaVentaModal({ clientes, onCerrar, onGuardado }) {
  const [productos, setProductos] = useState([])
  const [clienteId, setClienteId] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [estado, setEstado] = useState('pagada')
  const [items, setItems] = useState([]) // { producto_id, cantidad }
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [notasCredito, setNotasCredito] = useState([])
  const [aplicarCredito, setAplicarCredito] = useState(false)
  const [tasaHoy, setTasaHoy] = useState(null)
  const [porcentajeDescuento, setPorcentajeDescuento] = useState('')
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [telefonoNuevo, setTelefonoNuevo] = useState('')
  const [clienteCreadoId, setClienteCreadoId] = useState(null)
  const esNuevo = clienteId === NUEVO

  useEffect(() => {
    supabase.from('productos')
      .select('id, nombre, talla, color, precio_venta, stock_actual')
      .gt('stock_actual', 0)
      .order('nombre')
      .then(({ data }) => setProductos(data ?? []))
  }, [])

  useEffect(() => {
    const hoy = new Date().toLocaleDateString('en-CA')
    supabase.from('tasas_cambio').select('valor').eq('fecha', hoy).maybeSingle()
      .then(({ data }) => setTasaHoy(data?.valor ?? null))
  }, [])

  useEffect(() => {
    if (!clienteId || clienteId === NUEVO) { setNotasCredito([]); setAplicarCredito(false); return }
    supabase.from('notas_credito')
      .select('id, saldo_disponible')
      .eq('cliente_id', clienteId)
      .gt('saldo_disponible', 0)
      .order('fecha', { ascending: true }) // las más antiguas se usan primero
      .then(({ data }) => setNotasCredito(data ?? []))
  }, [clienteId])

  const productosFiltrados = useMemo(
    () => productos.filter((p) => p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase())),
    [productos, busquedaProducto]
  )

  const agregarItem = (producto) => {
    setItems((prev) => {
      const existente = prev.find((i) => i.producto_id === producto.id)
      if (existente) {
        return prev.map((i) => i.producto_id === producto.id
          ? { ...i, cantidad: Math.min(i.cantidad + 1, producto.stock_actual) }
          : i)
      }
      return [...prev, { producto_id: producto.id, cantidad: 1 }]
    })
  }

  const cambiarCantidad = (productoId, cantidad) => {
    const producto = productos.find((p) => p.id === productoId)
    const cant = Math.max(1, Math.min(Number(cantidad) || 1, producto.stock_actual))
    setItems((prev) => prev.map((i) => i.producto_id === productoId ? { ...i, cantidad: cant } : i))
  }

  const quitarItem = (productoId) => setItems((prev) => prev.filter((i) => i.producto_id !== productoId))

  const itemsConDetalle = items.map((i) => {
    const producto = productos.find((p) => p.id === i.producto_id)
    return { ...i, producto, subtotal: producto.precio_venta * i.cantidad }
  })

  const total = itemsConDetalle.reduce((sum, i) => sum + i.subtotal, 0)

  const aplicaDescuento = metodoPago === 'efectivo' || metodoPago === 'usdt'
  const descuentoMonto = aplicaDescuento ? total * (Number(porcentajeDescuento || 0) / 100) : 0
  const totalConDescuento = total - descuentoMonto

  const saldoCreditoDisponible = notasCredito.reduce((sum, n) => sum + Number(n.saldo_disponible), 0)
  const montoCreditoAplicado = aplicarCredito ? Math.min(saldoCreditoDisponible, totalConDescuento) : 0
  const totalAPagarSinRedondear = totalConDescuento - montoCreditoAplicado
  const totalAPagar = metodoPago === 'efectivo' ? Math.round(totalAPagarSinRedondear) : totalAPagarSinRedondear
  const ajustePorRedondeo = totalAPagar - totalAPagarSinRedondear

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!clienteId) { setError('Selecciona un cliente.'); return }
    if (esNuevo) {
      const nombre = nombreNuevo.trim()
      if (!nombre) { setError('Escribe el nombre del cliente nuevo.'); return }
      if (clientes.some((c) => c.nombre.trim().toLowerCase() === nombre.toLowerCase())) {
        setError('Ya existe un cliente con ese nombre. Selecciónalo en la lista.')
        return
      }
    }    
    if (items.length === 0) { setError('Agrega al menos un producto.'); return }

    setGuardando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      let idCliente = clienteId
      if (esNuevo) {
        if (clienteCreadoId) {
          idCliente = clienteCreadoId
        } else {
          const { data: nuevo, error: errCliente } = await supabase.from('clientes')
            .insert({ nombre: nombreNuevo.trim(), telefono: telefonoNuevo.trim() || null })
            .select('id').single()
          if (errCliente) throw errCliente
          idCliente = nuevo.id
          setClienteCreadoId(nuevo.id)
        }
      }

      const { data: venta, error: ventaError } = await supabase.from('ventas')
        .insert({
          cliente_id: idCliente, total: totalAPagar, credito_aplicado: montoCreditoAplicado,
          descuento_porcentaje: aplicaDescuento ? Number(porcentajeDescuento || 0) : 0,
          descuento_monto: descuentoMonto,
          metodo_pago: metodoPago, estado, usuario_id: user.id,
        })
        .select().single()
      if (ventaError) throw ventaError

      // Descontar el crédito usado de la(s) nota(s), empezando por las más antiguas
      if (montoCreditoAplicado > 0) {
        let restante = montoCreditoAplicado
        for (const nota of notasCredito) {
          if (restante <= 0) break
          const usar = Math.min(Number(nota.saldo_disponible), restante)
          const { error: notaError } = await supabase.from('notas_credito')
            .update({ saldo_disponible: Number(nota.saldo_disponible) - usar })
            .eq('id', nota.id)
          if (notaError) throw notaError
          restante -= usar
        }
      }

      const filasItems = itemsConDetalle.map((i) => ({
        venta_id: venta.id, producto_id: i.producto_id, cantidad: i.cantidad,
        precio_unitario: i.producto.precio_venta, subtotal: i.subtotal,
      }))
      const { error: itemsError } = await supabase.from('venta_items').insert(filasItems)
      if (itemsError) throw itemsError

      // Si la venta queda pendiente, generar automáticamente su cuenta por cobrar
      if (estado === 'pendiente') {
        const { error: cuentaError } = await supabase.from('cuentas_por_cobrar')
          .insert({ venta_id: venta.id, cliente_id: idCliente, monto_total: totalAPagar })
        if (cuentaError) throw cuentaError
      }

      // Descontar stock y registrar movimiento por cada producto vendido
      for (const i of itemsConDetalle) {
        await supabase.from('productos')
          .update({ stock_actual: i.producto.stock_actual - i.cantidad, actualizado_en: new Date().toISOString() })
          .eq('id', i.producto_id)
        await supabase.from('movimientos_inventario')
          .insert({ producto_id: i.producto_id, tipo: 'salida', cantidad: i.cantidad, motivo: 'Venta', usuario_id: user.id })
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
      <div className="nk-modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <h2>Registrar venta</h2>
        <hr className="nk-stitch" style={{ margin: '12px 0 20px' }} />

        <form onSubmit={handleSubmit} className="nk-producto-form">
          <div className="nk-producto-form-row">
            <div className="nk-field">
              <label>Cliente</label>
              <select required value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                <option value="" disabled>Selecciona un cliente</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                <option value={NUEVO}>Agregar cliente…</option>
              </select>
            </div>
            <div className="nk-field">
              <label>Método de pago</label>
              <select
                value={metodoPago}
                onChange={(e) => {
                  setMetodoPago(e.target.value)
                  if (!['efectivo', 'usdt'].includes(e.target.value)) setPorcentajeDescuento('')
                }}
              >
                <option value="efectivo">Efectivo</option>
                <option value="pm_transferencia">PM / Transferencia</option>
                <option value="usdt">USDT</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="mixto">Mixto</option>
              </select>
            </div>
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

          {aplicaDescuento && (
            <div className="nk-field">
              <label>Porcentaje a descontar (%)</label>
              <input
                type="number" min="0" max="100" step="0.1"
                value={porcentajeDescuento}
                onChange={(e) => setPorcentajeDescuento(e.target.value)}
                placeholder="Ej: 10"
              />
            </div>
          )}

          <div className="nk-field">
            <label>Estado del pago</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="pagada">Pagada por completo</option>
              <option value="pendiente">Pendiente (queda a crédito)</option>
            </select>
          </div>

          <hr className="nk-stitch" />

          <div className="nk-field">
            <label>Buscar producto</label>
            <input
              placeholder="Escribe para buscar…"
              value={busquedaProducto}
              onChange={(e) => setBusquedaProducto(e.target.value)}
            />
          </div>

          {busquedaProducto && (
            <div className="nk-venta-resultados">
              {productosFiltrados.slice(0, 5).map((p) => (
                <button type="button" key={p.id} className="nk-venta-resultado" onClick={() => { agregarItem(p); setBusquedaProducto('') }}>
                  <span>{p.nombre} {p.talla && `· ${p.talla}`}</span>
                  <span>${Number(p.precio_venta).toFixed(2)} · stock {p.stock_actual}</span>
                </button>
              ))}
              {productosFiltrados.length === 0 && <p style={{ color: 'var(--nk-ink-faint)', fontSize: 13 }}>Sin resultados.</p>}
            </div>
          )}

          {itemsConDetalle.length > 0 && (
            <div className="nk-venta-items">
              {itemsConDetalle.map((i) => (
                <div key={i.producto_id} className="nk-venta-item">
                  <span className="nk-venta-item-nombre">{i.producto.nombre}</span>
                  <input
                    type="number" min="1" max={i.producto.stock_actual}
                    value={i.cantidad}
                    onChange={(e) => cambiarCantidad(i.producto_id, e.target.value)}
                  />
                  <span className="nk-venta-item-subtotal">${i.subtotal.toFixed(2)}</span>
                  <button type="button" className="nk-venta-item-quitar" onClick={() => quitarItem(i.producto_id)}>✕</button>
                </div>
              ))}
            </div>
          )}

          {saldoCreditoDisponible > 0 && (
            <label className="nk-devolucion-item-check" style={{ fontWeight: 400 }}>
              <input type="checkbox" checked={aplicarCredito} onChange={(e) => setAplicarCredito(e.target.checked)} />
              Aplicar crédito disponible (${saldoCreditoDisponible.toFixed(2)})
            </label>
          )}

          {(descuentoMonto > 0 || montoCreditoAplicado > 0) && (
            <div className="nk-venta-total" style={{ borderTop: 'none', paddingTop: 0, fontSize: 14, fontWeight: 400 }}>
              <span>Subtotal</span>
              <span>${total.toFixed(2)}</span>
            </div>
          )}
          {descuentoMonto > 0 && (
            <div className="nk-venta-total" style={{ borderTop: 'none', paddingTop: 0, fontSize: 14, fontWeight: 400, color: 'var(--nk-marigold)' }}>
              <span>Descuento ({porcentajeDescuento}%)</span>
              <span>−${descuentoMonto.toFixed(2)}</span>
            </div>
          )}
          {montoCreditoAplicado > 0 && (
            <div className="nk-venta-total" style={{ borderTop: 'none', paddingTop: 0, fontSize: 14, fontWeight: 400, color: 'var(--nk-marigold)' }}>
              <span>Crédito aplicado</span>
              <span>−${montoCreditoAplicado.toFixed(2)}</span>
            </div>
          )}
          {ajustePorRedondeo !== 0 && (
            <div className="nk-venta-total" style={{ borderTop: 'none', paddingTop: 0, fontSize: 13, fontWeight: 400, color: 'var(--nk-ink-soft)' }}>
              <span>Ajuste por redondeo</span>
              <span>{ajustePorRedondeo >= 0 ? '+' : ''}${ajustePorRedondeo.toFixed(2)}</span>
            </div>
          )}
          <div className="nk-venta-total">
            <span>{descuentoMonto > 0 ? 'Monto total con descuento' : 'Total a pagar'}</span>
            <span>${totalAPagar.toFixed(2)}</span>
          </div>

          {metodoPago === 'pm_transferencia' && (
            tasaHoy ? (
              <div className="nk-venta-total" style={{ borderTop: 'none', paddingTop: 0, fontSize: 15, color: 'var(--nk-teal-deep)' }}>
                <span>Equivalente en bolívares</span>
                <span>Bs {(totalAPagar * tasaHoy).toFixed(2)}</span>
              </div>
            ) : (
              <p className="nk-inv-card-meta" style={{ color: 'var(--nk-coral)' }}>
                No hay tasa configurada para hoy — ve a Cuadre de caja para establecerla.
              </p>
            )
          )}

          {error && <p className="nk-error-text" role="alert">{error}</p>}

          <div className="nk-producto-form-actions">
            <button type="button" className="nk-btn nk-btn-ghost" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="nk-btn nk-btn-primary" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Registrar venta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}