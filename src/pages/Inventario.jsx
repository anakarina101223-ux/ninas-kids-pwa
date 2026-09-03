import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import ProductoForm from '../components/Inventario/ProductoForm'
import MovimientoStockModal from '../components/Inventario/MovimientoStockModal'
import './Inventario.css'
import * as XLSX from 'xlsx'

export default function Inventario() {
  const [categorias, setCategorias] = useState([])
  const [subcategorias, setSubcategorias] = useState([])
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [filtroGenero, setFiltroGenero] = useState('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const [mostrarArchivados, setMostrarArchivados] = useState(false)

  const [productoEditando, setProductoEditando] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [productoParaMovimiento, setProductoParaMovimiento] = useState(null)

  const cargarTodo = useCallback(async () => {
    setCargando(true)
    const [{ data: cats, error: e1 }, { data: subs, error: e2 }, { data: prods, error: e3 }] = await Promise.all([
      supabase.from('categorias').select('id, genero, nombre, orden').order('genero').order('orden'),
      supabase.from('subcategorias').select('id, categoria_id, nombre'),
      supabase.from('productos')
        .select('id, nombre, talla, color,precio_costo, comision, precio_venta, stock_actual, stock_minimo, sku, imagen_url, activo, categoria_id, subcategoria_id')
        .order('nombre'),
    ])
    if (e1 || e2 || e3) setError((e1 || e2 || e3).message)
    setCategorias(cats ?? [])
    setSubcategorias(subs ?? [])
    setProductos(prods ?? [])
    setCargando(false)
  }, [])

  useEffect(() => { cargarTodo() }, [cargarTodo])

  const categoriasFiltradas = useMemo(
    () => categorias.filter((c) => filtroGenero === 'todos' || c.genero === filtroGenero),
    [categorias, filtroGenero]
  )

  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      if (!mostrarArchivados && !p.activo) return false
      const cat = categorias.find((c) => c.id === p.categoria_id)
      if (filtroGenero !== 'todos' && cat?.genero !== filtroGenero) return false
      if (filtroCategoria !== 'todas' && p.categoria_id !== filtroCategoria) return false
      if (busqueda && !p.nombre.toLowerCase().includes(busqueda.toLowerCase()) && !(p.sku ?? '').toLowerCase().includes(busqueda.toLowerCase())) return false
      return true
    })
  }, [productos, categorias, filtroGenero, filtroCategoria, busqueda, mostrarArchivados])

  const nombreCategoria = (id) => categorias.find((c) => c.id === id)?.nombre ?? '—'
  const nombreSubcategoria = (id) => subcategorias.find((s) => s.id === id)?.nombre

  const abrirNuevo = () => { setProductoEditando(null); setMostrarForm(true) }
  const abrirEditar = (p) => { setProductoEditando(p); setMostrarForm(true) }

  const eliminarProducto = async (p) => {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return

    const { error } = await supabase.from('productos').delete().eq('id', p.id)

    if (error?.code === '23503') {
      // Tiene ventas asociadas — no se puede borrar sin perder el historial, así que se archiva
      const { error: archivarError } = await supabase.from('productos').update({ activo: false }).eq('id', p.id)
      if (archivarError) { setError(archivarError.message); return }
      alert(`"${p.nombre}" ya tiene ventas registradas, así que no se puede eliminar sin perder ese historial. Se archivó en su lugar — dejará de aparecer en el catálogo activo, pero sus ventas pasadas se conservan intactas.`)
      cargarTodo()
      return
    }

    if (error) { setError(error.message); return }
    cargarTodo()
  }

  const reactivarProducto = async (p) => {
    const { error } = await supabase.from('productos').update({ activo: true }).eq('id', p.id)
    if (error) setError(error.message)
    else cargarTodo()
  }

  const exportarExcel = () => {
    const filas = productosFiltrados.map((p) => {
      const costo = Number(p.precio_costo ?? 0)
      const comision = Number(p.comision ?? 0)
      const costoTotal = costo + comision
      const venta = Number(p.precio_venta)
      return {
        SKU: p.sku || '—',
        Categoría: nombreCategoria(p.categoria_id),
        Subcategoría: nombreSubcategoria(p.subcategoria_id) || '—',
        Nombre: p.nombre,
        Talla: p.talla || '—',
        Color: p.color || '—',
        'Precio costo': costo,
        'Comisión': comision,
        'Costo total': costoTotal,
        'Precio venta': venta,
        'Ganancia': venta - costoTotal,
        'Stock actual': p.stock_actual,
        'Stock mínimo': p.stock_minimo,
        Estado: p.stock_actual <= p.stock_minimo ? 'Stock bajo' : 'OK',
      }
    })

    const hoja = XLSX.utils.json_to_sheet(filas)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Inventario')

    const etiquetaGenero = filtroGenero === 'todos' ? 'Completo' : filtroGenero === 'niño' ? 'Niños' : 'Niñas'
    XLSX.writeFile(libro, `Nina's Kids - Inventario ${etiquetaGenero}.xlsx`)
  }

  return (
    <div>
      <div className="nk-inv-header">
        <div>
          <h1>Inventario</h1>
          <p style={{ color: 'var(--nk-ink-soft)', margin: '4px 0 0' }}>
            {productosFiltrados.length} producto{productosFiltrados.length !== 1 && 's'}
          </p>
        </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="nk-btn nk-btn-ghost" onClick={exportarExcel}>⬇ Excel</button>
            <button className="nk-btn nk-btn-primary" onClick={abrirNuevo}>+ Nuevo producto</button>
          </div>
      </div>

      <div className="nk-inv-filtros">
        <div className="nk-inv-genero-tabs">
          {['todos', 'niño', 'niña'].map((g) => (
            <button
              key={g}
              className={[
                'nk-inv-genero-tab',
                filtroGenero === g ? 'nk-inv-genero-tab-activo' : '',
                filtroGenero === g && g === 'niño' ? 'nk-inv-genero-tab-nino' : '',
                filtroGenero === g && g === 'niña' ? 'nk-inv-genero-tab-nina' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => { setFiltroGenero(g); setFiltroCategoria('todas') }}
            >
              {g === 'todos' ? 'Todos' : g === 'niño' ? 'Niños' : 'Niñas'}
            </button>
          ))}
        </div>

        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
          <option value="todas">Todas las categorías</option>
          {categoriasFiltradas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>

        <input
          className="nk-inv-buscador"
          placeholder="Buscar por nombre o SKU…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        <label className="nk-devolucion-item-check" style={{ fontWeight: 400, fontSize: 13 }}>
          <input type="checkbox" checked={mostrarArchivados} onChange={(e) => setMostrarArchivados(e.target.checked)} />
          Mostrar archivados
        </label>
      </div>

      {error && <p className="nk-error-text" role="alert" style={{ margin: '12px 0' }}>{error}</p>}

      {cargando ? (
        <p style={{ color: 'var(--nk-ink-soft)' }}>Cargando inventario…</p>
      ) : (
        <div className="nk-inv-grid">
          {productosFiltrados.map((p) => (
            <div key={p.id} className="nk-card nk-inv-card">
              <div className="nk-inv-card-img">
                {p.imagen_url
                  ? <img src={p.imagen_url} alt={p.nombre} />
                  : <div className="nk-inv-card-img-placeholder">👕</div>}
                {p.stock_actual <= p.stock_minimo && (
                  <span className="nk-chip nk-chip-coral nk-inv-card-badge">Stock bajo</span>
                )}
              </div>
              <div className="nk-inv-card-body">
                <span className="nk-chip nk-chip-teal">{nombreCategoria(p.categoria_id)}</span>
                {nombreSubcategoria(p.subcategoria_id) && (
                  <span className="nk-chip nk-chip-marigold">{nombreSubcategoria(p.subcategoria_id)}</span>
                )}
                <h3>{p.nombre}</h3>
                <p className="nk-inv-card-meta">
                  {[p.talla, p.color].filter(Boolean).join(' · ') || '—'}
                </p>
                <div className="nk-inv-card-footer">
                  <span className="nk-inv-card-precio">${Number(p.precio_venta).toFixed(2)}</span>
                  <span className="nk-inv-card-stock">Stock: {p.stock_actual}</span>
                </div>
                {!p.activo && <span className="nk-chip nk-chip-coral" style={{ alignSelf: 'flex-start' }}>Archivado</span>}
                <div className="nk-inv-card-actions">
                  {p.activo ? (
                    <>
                      <button className="nk-btn nk-btn-ghost" onClick={() => setProductoParaMovimiento(p)}>Ajustar stock</button>
                      <button className="nk-btn nk-btn-ghost" onClick={() => abrirEditar(p)}>Editar</button>
                      <button className="nk-btn nk-btn-danger" onClick={() => eliminarProducto(p)}>Eliminar</button>
                    </>
                  ) : (
                    <button className="nk-btn nk-btn-primary" onClick={() => reactivarProducto(p)}>Reactivar</button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {productosFiltrados.length === 0 && (
            <p style={{ color: 'var(--nk-ink-faint)', gridColumn: '1 / -1', textAlign: 'center', padding: 40 }}>
              No hay productos que coincidan con el filtro.
            </p>
          )}
        </div>
      )}

      {mostrarForm && (
        <ProductoForm
          producto={productoEditando}
          categorias={categorias}
          subcategorias={subcategorias}
          onCerrar={() => setMostrarForm(false)}
          onGuardado={() => { setMostrarForm(false); cargarTodo() }}
        />
      )}

      {productoParaMovimiento && (
        <MovimientoStockModal
          producto={productoParaMovimiento}
          onCerrar={() => setProductoParaMovimiento(null)}
          onGuardado={() => { setProductoParaMovimiento(null); cargarTodo() }}
        />
      )}
    </div>
  )
}