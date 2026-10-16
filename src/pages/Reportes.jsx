import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import './Reportes.css'

const METODO_LABEL = { efectivo: 'Efectivo', pm_transferencia: 'PM / Transferencia', usdt: 'USDT', zelle: 'Zelle', tarjeta: 'Tarjeta', mixto: 'Mixto' }

const mesActualISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Reportes() {
  const [mes, setMes] = useState(mesActualISO()) // "YYYY-MM"
  const [clientes, setClientes] = useState([])
  const [filtroCliente, setFiltroCliente] = useState('todos')
  const [filtroMetodo, setFiltroMetodo] = useState('todos')
  const [modo, setModo] = useState('mensual') // 'mensual' | 'diario'
  const [diaSeleccionado, setDiaSeleccionado] = useState(new Date().toLocaleDateString('en-CA')) // YYYY-MM-DD

  const [ventas, setVentas] = useState([])
  const [itemsReporte, setItemsReporte] = useState([])
  const [totalAbonos, setTotalAbonos] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const rango = useMemo(() => {
    if (modo === 'diario') {
        const inicio = new Date(`${diaSeleccionado}T00:00:00`)
        const fin = new Date(`${diaSeleccionado}T23:59:59`)
        return { inicio: inicio.toISOString(), fin: fin.toISOString(), etiqueta: inicio.toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' }) }
    }
    const [año, mesNum] = mes.split('-').map(Number)
    const inicio = new Date(año, mesNum - 1, 1)
    const fin = new Date(año, mesNum, 0, 23, 59, 59)
    return { inicio: inicio.toISOString(), fin: fin.toISOString(), etiqueta: inicio.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' }) }
  }, [modo, mes, diaSeleccionado])

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')

    const [{ data: v, error: e1 }, { data: items, error: e2 }, { data: ab, error: e3 }, { data: cl }] = await Promise.all([
      supabase.from('ventas')
        .select('id, fecha, total, total_devuelto, metodo_pago, estado, cliente_id')
        .gte('fecha', rango.inicio).lte('fecha', rango.fin),
      supabase.from('reporte_venta_items')
        .select('venta_id, cantidad, subtotal, categoria_nombre, genero, metodo_pago, cliente_id')
        .gte('fecha', rango.inicio).lte('fecha', rango.fin),
      supabase.from('abonos').select('monto').gte('fecha', rango.inicio).lte('fecha', rango.fin),
      supabase.from('clientes').select('id, nombre').order('nombre'),
    ])

    if (e1 || e2 || e3) setError((e1 || e2 || e3).message)
    setVentas(v ?? [])
    setItemsReporte(items ?? [])
    setTotalAbonos((ab ?? []).reduce((s, a) => s + Number(a.monto), 0))
    setClientes(cl ?? [])
    setCargando(false)
  }, [rango])

  useEffect(() => { cargar() }, [cargar])

  const ventasFiltradas = useMemo(() => ventas.filter((v) => {
    if (filtroCliente !== 'todos' && v.cliente_id !== filtroCliente) return false
    if (filtroMetodo !== 'todos' && v.metodo_pago !== filtroMetodo) return false
    return true
  }), [ventas, filtroCliente, filtroMetodo])

  const itemsFiltrados = useMemo(() => itemsReporte.filter((i) => {
    if (filtroCliente !== 'todos' && i.cliente_id !== filtroCliente) return false
    if (filtroMetodo !== 'todos' && i.metodo_pago !== filtroMetodo) return false
    return true
  }), [itemsReporte, filtroCliente, filtroMetodo])

  const nombreCliente = (id) => clientes.find((c) => c.id === id)?.nombre ?? '—'

  const totalVendidoNeto = ventasFiltradas.reduce((s, v) => s + (Number(v.total) - Number(v.total_devuelto ?? 0)), 0)
  const cantidadVentas = ventasFiltradas.length
  const ticketPromedio = cantidadVentas > 0 ? totalVendidoNeto / cantidadVentas : 0

  const porCategoria = useMemo(() => {
    const grupos = {}
    for (const i of itemsFiltrados) {
      const key = i.categoria_nombre
      if (!grupos[key]) grupos[key] = { nombre: key, cantidad: 0, total: 0 }
      grupos[key].cantidad += i.cantidad
      grupos[key].total += Number(i.subtotal)
    }
    return Object.values(grupos).sort((a, b) => b.total - a.total)
  }, [itemsFiltrados])

  const porMetodo = useMemo(() => {
    const grupos = {}
    for (const v of ventasFiltradas) {
      if (!grupos[v.metodo_pago]) grupos[v.metodo_pago] = 0
      grupos[v.metodo_pago] += Number(v.total) - Number(v.total_devuelto ?? 0)
    }
    return grupos
  }, [ventasFiltradas])

  const exportarExcel = () => {
    const filas = ventasFiltradas.map((v) => ({
      Fecha: new Date(v.fecha).toLocaleDateString('es-VE'),
      Cliente: nombreCliente(v.cliente_id),
      Método: METODO_LABEL[v.metodo_pago],
      Estado: v.estado === 'pagada' ? 'Pagada' : 'Pendiente',
      Total: Number(v.total),
      Devuelto: Number(v.total_devuelto ?? 0),
      Neto: Number(v.total) - Number(v.total_devuelto ?? 0),
    }))
    const hoja = XLSX.utils.json_to_sheet(filas)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Ventas')

    const resumenFilas = porCategoria.map((c) => ({ Categoría: c.nombre, Cantidad: c.cantidad, Total: c.total }))
    const hojaResumen = XLSX.utils.json_to_sheet(resumenFilas)
    XLSX.utils.book_append_sheet(libro, hojaResumen, 'Por categoría')

    XLSX.writeFile(libro, `Nina's Kids - Ventas ${modo === 'diario' ? 'del' : 'de'} ${rango.etiqueta}.xlsx`)
  }

  const exportarPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text("Nina's Kids — Reporte de ventas", 14, 18)
    doc.setFontSize(11)
    doc.text(`Período: ${rango.etiqueta}`, 14, 26)
    doc.text(`Total vendido (neto): $${totalVendidoNeto.toFixed(2)}`, 14, 33)
    doc.text(`Total abonado a cuentas por cobrar: $${totalAbonos.toFixed(2)}`, 14, 40)
    doc.text(`Cantidad de ventas: ${cantidadVentas} · Ticket promedio: $${ticketPromedio.toFixed(2)}`, 14, 47)

    autoTable(doc, {
      startY: 55,
      head: [['Fecha', 'Cliente', 'Método', 'Estado', 'Neto']],
      body: ventasFiltradas.map((v) => [
        new Date(v.fecha).toLocaleDateString('es-VE'),
        nombreCliente(v.cliente_id),
        METODO_LABEL[v.metodo_pago],
        v.estado === 'pagada' ? 'Pagada' : 'Pendiente',
        `$${(Number(v.total) - Number(v.total_devuelto ?? 0)).toFixed(2)}`,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 124, 130] }, // var(--nk-teal)
    })

    doc.save(`Nina's Kids - Ventas ${modo === 'diario' ? 'del' : 'de'} ${rango.etiqueta}.pdf`)
  }

  return (
    <div>
      <div className="nk-reportes-header">
        <div>
          <h1>Reportes</h1>
          <p style={{ color: 'var(--nk-ink-soft)', margin: '4px 0 0', textTransform: 'capitalize' }}>{rango.etiqueta}</p>
        </div>
        <div className="nk-reportes-acciones">
          <button className="nk-btn nk-btn-ghost" onClick={exportarExcel}>⬇ Excel</button>
          <button className="nk-btn nk-btn-ghost" onClick={exportarPDF}>⬇ PDF</button>
        </div>
      </div>

      <div className="nk-reportes-filtros">
        <div className="nk-inv-genero-tabs">
            <button className={`nk-inv-genero-tab ${modo === 'diario' ? 'nk-inv-genero-tab-activo' : ''}`} onClick={() => setModo('diario')}>
                Diario
            </button>
            <button className={`nk-inv-genero-tab ${modo === 'mensual' ? 'nk-inv-genero-tab-activo' : ''}`} onClick={() => setModo('mensual')}>
                Mensual
            </button>
        </div>
        {modo === 'diario' ? (
            <input type="date" value={diaSeleccionado} onChange={(e) => setDiaSeleccionado(e.target.value)} />
        ) : (
            <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
        )}
        
        <select value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}>
          <option value="todos">Todos los clientes</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select value={filtroMetodo} onChange={(e) => setFiltroMetodo(e.target.value)}>
          <option value="todos">Todos los métodos</option>
          {Object.entries(METODO_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>

      {error && <p className="nk-error-text" role="alert" style={{ margin: '12px 0' }}>{error}</p>}

      {cargando ? (
        <p style={{ color: 'var(--nk-ink-soft)' }}>Cargando reporte…</p>
      ) : (
        <>
          <div className="nk-reportes-resumen">
            <div className="nk-card nk-reportes-stat">
              <span className="nk-inv-card-meta">Total vendido (neto)</span>
              <strong>${totalVendidoNeto.toFixed(2)}</strong>
            </div>
            <div className="nk-card nk-reportes-stat">
              <span className="nk-inv-card-meta">Ventas registradas</span>
              <strong>{cantidadVentas}</strong>
            </div>
            <div className="nk-card nk-reportes-stat">
              <span className="nk-inv-card-meta">Ticket promedio</span>
              <strong>${ticketPromedio.toFixed(2)}</strong>
            </div>
            <div className="nk-card nk-reportes-stat">
              <span className="nk-inv-card-meta">Abonado a cuentas por cobrar</span>
              <strong>${totalAbonos.toFixed(2)}</strong>
            </div>
          </div>

          <div className="nk-reportes-columnas">
            <div className="nk-card nk-reportes-bloque">
              <h3>Ventas por categoría</h3>
              <hr className="nk-stitch" style={{ margin: '10px 0' }} />
              {porCategoria.length === 0 ? (
                <p className="nk-inv-card-meta">Sin datos en este período.</p>
              ) : porCategoria.map((c) => (
                <div key={c.nombre} className="nk-cuadre-linea">
                  <span>{c.nombre} <span className="nk-inv-card-meta">({c.cantidad} uds.)</span></span>
                  <span>${c.total.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="nk-card nk-reportes-bloque">
              <h3>Ventas por método de pago</h3>
              <hr className="nk-stitch" style={{ margin: '10px 0' }} />
              {Object.entries(porMetodo).length === 0 ? (
                <p className="nk-inv-card-meta">Sin datos en este período.</p>
              ) : Object.entries(porMetodo).map(([metodo, monto]) => (
                <div key={metodo} className="nk-cuadre-linea">
                  <span>{METODO_LABEL[metodo]}</span>
                  <span>${monto.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="nk-card nk-reportes-tabla-wrap">
            <table className="nk-clientes-table">
              <thead>
                <tr><th>Fecha</th><th>Cliente</th><th>Método</th><th>Estado</th><th>Neto</th></tr>
              </thead>
              <tbody>
                {ventasFiltradas.map((v) => (
                  <tr key={v.id}>
                    <td>{new Date(v.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}</td>
                    <td>{nombreCliente(v.cliente_id)}</td>
                    <td>{METODO_LABEL[v.metodo_pago]}</td>
                    <td>
                      <span className={`nk-chip ${v.estado === 'pagada' ? 'nk-chip-green' : 'nk-chip-coral'}`}>
                        {v.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="nk-users-mono">${(Number(v.total) - Number(v.total_devuelto ?? 0)).toFixed(2)}</td>
                  </tr>
                ))}
                {ventasFiltradas.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--nk-ink-faint)' }}>
                    No hay ventas en este período con los filtros aplicados.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}