import { useState, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { comprimirImagen } from '../../lib/comprimirImagen'
import './ProductoForm.css'

const VACIO = {
  categoria_id: '', subcategoria_id: '', nombre: '', talla: '', color: '',
  precio_costo: '', comision: '', precio_venta: '', stock_actual: '', stock_minimo: '0', sku: '',
}

export default function ProductoForm({ producto, categorias, subcategorias, onCerrar, onGuardado }) {
  const esEdicion = Boolean(producto)
  const [form, setForm] = useState(
    producto
      ? {
          categoria_id: producto.categoria_id ?? '',
          subcategoria_id: producto.subcategoria_id ?? '',
          nombre: producto.nombre ?? '',
          talla: producto.talla ?? '',
          color: producto.color ?? '',
          precio_costo: producto.precio_costo ?? '',
          comision: producto.comision ?? '',
          precio_venta: producto.precio_venta ?? '',
          stock_actual: producto.stock_actual ?? '',
          stock_minimo: producto.stock_minimo ?? '0',
          sku: producto.sku ?? '',
        }
      : VACIO
  )
  const [archivoImagen, setArchivoImagen] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const subcategoriasDisponibles = useMemo(
    () => subcategorias.filter((s) => s.categoria_id === form.categoria_id),
    [subcategorias, form.categoria_id]
  )

  const costoTotal = (Number(form.precio_costo) || 0) + (Number(form.comision) || 0)
  const ganancia = (Number(form.precio_venta) || 0) - costoTotal
  const margen = costoTotal > 0 ? (ganancia / costoTotal) * 100 : 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setGuardando(true)

    try {
      let imagen_url = producto?.imagen_url ?? null

      if (archivoImagen) {
        const imagenComprimida = await comprimirImagen(archivoImagen)
        const ruta = `${crypto.randomUUID()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('productos')
          .upload(ruta, imagenComprimida, { contentType: 'image/jpeg', cacheControl: '31536000' })
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('productos').getPublicUrl(ruta)
        imagen_url = urlData.publicUrl
      }

      const payload = {
        categoria_id: form.categoria_id,
        subcategoria_id: form.subcategoria_id || null,
        nombre: form.nombre,
        talla: form.talla || null,
        color: form.color || null,
        precio_costo: Number(form.precio_costo) || 0,
        comision: Number(form.comision) || 0,
        precio_venta: Number(form.precio_venta) || 0,
        stock_actual: Number(form.stock_actual) || 0,
        stock_minimo: Number(form.stock_minimo) || 0,
        sku: form.sku || null,
        imagen_url,
        actualizado_en: new Date().toISOString(),
      }

      const { error: dbError } = esEdicion
        ? await supabase.from('productos').update(payload).eq('id', producto.id)
        : await supabase.from('productos').insert(payload)

      if (dbError) throw dbError
      onGuardado()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="nk-modal-overlay" onClick={onCerrar}>
      <div className="nk-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{esEdicion ? 'Editar producto' : 'Nuevo producto'}</h2>
        <hr className="nk-stitch" style={{ margin: '12px 0 20px' }} />

        <form onSubmit={handleSubmit} className="nk-producto-form">
          <div className="nk-field">
            <label>Categoría</label>
            <select
              required
              value={form.categoria_id}
              onChange={(e) => setForm({ ...form, categoria_id: e.target.value, subcategoria_id: '' })}
            >
              <option value="" disabled>Selecciona una categoría</option>
              <optgroup label="Niños">
                {categorias.filter((c) => c.genero === 'niño').map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </optgroup>
              <optgroup label="Niñas">
                {categorias.filter((c) => c.genero === 'niña').map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {subcategoriasDisponibles.length > 0 && (
            <div className="nk-field">
              <label>Subcategoría</label>
              <select value={form.subcategoria_id} onChange={(e) => setForm({ ...form, subcategoria_id: e.target.value })}>
                <option value="">Sin subcategoría</option>
                {subcategoriasDisponibles.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          )}

          <div className="nk-field">
            <label>Nombre</label>
            <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>

          <div className="nk-producto-form-row">
            <div className="nk-field">
              <label>Talla</label>
              <input value={form.talla} onChange={(e) => setForm({ ...form, talla: e.target.value })} />
            </div>
            <div className="nk-field">
              <label>Color</label>
              <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
          </div>
          
          <div className="nk-producto-form-row">
            <div className="nk-field">
              <label>Precio costo</label>
              <input type="number" step="0.01" min="0" value={form.precio_costo}
                onChange={(e) => setForm({ ...form, precio_costo: e.target.value })} />
            </div>
            <div className="nk-field">
              <label>Comisión de compra</label>
              <input type="number" step="0.01" min="0" value={form.comision}
                onChange={(e) => setForm({ ...form, comision: e.target.value })} />
            </div>
          </div>

          <div className="nk-field">
            <label>Precio venta</label>
            <input required type="number" step="0.01" min="0" value={form.precio_venta}
              onChange={(e) => setForm({ ...form, precio_venta: e.target.value })} />
          </div>

          <div className="nk-producto-resumen">
            <div className="nk-cuadre-linea"><span>Costo total (costo + comisión)</span><span>${costoTotal.toFixed(2)}</span></div>
            <div className="nk-cuadre-linea"><span>Ganancia por unidad</span><span>${ganancia.toFixed(2)}</span></div>
            <div className="nk-cuadre-linea nk-cuadre-linea-total"><span>Margen</span><span>{margen.toFixed(1)}%</span></div>
          </div>

          <div className="nk-producto-form-row">
            <div className="nk-field">
              <label>Stock inicial</label>
              <input required type="number" min="0" value={form.stock_actual}
                onChange={(e) => setForm({ ...form, stock_actual: e.target.value })} />
            </div>
            <div className="nk-field">
              <label>Stock mínimo</label>
              <input type="number" min="0" value={form.stock_minimo}
                onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })} />
            </div>
          </div>

          <div className="nk-field">
            <label>SKU / código (opcional)</label>
            <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>

          <div className="nk-field">
            <label>Foto del producto</label>
            <input type="file" accept="image/*" onChange={(e) => setArchivoImagen(e.target.files[0])} />
          </div>

          {error && <p className="nk-error-text" role="alert">{error}</p>}

          <div className="nk-producto-form-actions">
            <button type="button" className="nk-btn nk-btn-ghost" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="nk-btn nk-btn-primary" disabled={guardando}>
              {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}