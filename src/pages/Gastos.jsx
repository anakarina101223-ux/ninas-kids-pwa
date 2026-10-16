import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import * as XLSX from 'xlsx'
import './Gastos.css'

const hoyISO = () => new Date().toLocaleDateString('en-CA')

const rangoDelMes = (mes) => {
  const [año, m] = mes.split('-').map(Number)
  const ultimo = new Date(año, m, 0).getDate()
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, '0')}` }
}

export default function Gastos() {
  const [mes, setMes] = useState(hoyISO().slice(0, 7))
  const [gastos, setGastos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [fecha, setFecha] = useState(hoyISO())
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const descripcionRef = useRef(null)

  const { desde, hasta } = useMemo(() => rangoDelMes(mes), [mes])

  const cargar = useCallback(async () => {
    setCargando(true)
    const { data, error } = await supabase.from('gastos').select('*')
      .gte('fecha', desde).lte('fecha', hasta)
      .order('fecha').order('creado_en')
    if (error) setError(error.message)
    else setGastos(data ?? [])
    setCargando(false)
  }, [desde, hasta])

  useEffect(() => { cargar() }, [cargar])

  // Al cambiar de mes, la fecha del formulario cae dentro de ese mes
  useEffect(() => {
    setFecha(mes === hoyISO().slice(0, 7) ? hoyISO() : desde)
    setEditandoId(null)
    setDescripcion('')
    setMonto('')
  }, [mes, desde])

  const conAcumulado = useMemo(() => {
    let acc = 0
    return gastos.map((g) => {
      acc += Number(g.monto)
      return { ...g, acumulado: Math.round(acc * 100) / 100 }
    })
  }, [gastos])

  const totalMes = conAcumulado.length > 0 ? conAcumulado[conAcumulado.length - 1].acumulado : 0

  const sugerencias = useMemo(() => [...new Set(gastos.map((g) => g.descripcion))], [gastos])

  const limpiarFormulario = () => {
    setEditandoId(null)
    setDescripcion('')
    setMonto('')
    descripcionRef.current?.focus()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const montoNum = Number(monto)
    if (!descripcion.trim()) { setError('Escribe una descripción.'); return }
    if (!montoNum || montoNum <= 0) { setError('Ingresa un monto válido.'); return }

    setGuardando(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = { fecha, descripcion: descripcion.trim(), monto: montoNum, usuario_id: user.id }

    const { error } = editandoId
      ? await supabase.from('gastos').update(payload).eq('id', editandoId)
      : await supabase.from('gastos').insert(payload)

    setGuardando(false)
    if (error) { setError(error.message); return }
    limpiarFormulario()
    cargar()
  }

  const iniciarEdicion = (g) => {
    setEditandoId(g.id)
    setFecha(g.fecha)
    setDescripcion(g.descripcion)
    setMonto(g.monto)
    descripcionRef.current?.focus()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const eliminar = async (g) => {
    if (!confirm(`¿Eliminar el gasto "${g.descripcion}" por $${Number(g.monto).toFixed(2)}?`)) return
    const { error } = await supabase.from('gastos').delete().eq('id', g.id)
    if (error) { setError(error.message); return }
    if (editandoId === g.id) limpiarFormulario()
    cargar()
  }

  const etiquetaMes = new Date(`${mes}-01T00:00:00`).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })

  const exportarExcel = () => {
    const filas = conAcumulado.map((g) => ({
      FECHA: new Date(g.fecha + 'T00:00:00').toLocaleDateString('es-VE'),
      DESCRIPCION: g.descripcion,
      MONTO: Number(g.monto),
      SALDO: g.acumulado,
    }))
    const hoja = XLSX.utils.json_to_sheet(filas)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, `GASTOS ${etiquetaMes}`.toUpperCase().slice(0, 31))
    XLSX.writeFile(libro, `Nina's Kids - Gastos ${etiquetaMes}.xlsx`)
  }

  return (
    <div>
      <div className="nk-gastos-header">
        <div>
          <h1>Gastos</h1>
          <p style={{ color: 'var(--nk-ink-soft)', margin: '4px 0 0', textTransform: 'capitalize' }}>
            {etiquetaMes} · Total: <strong style={{ color: 'var(--nk-coral)' }}>${totalMes.toFixed(2)}</strong>
          </p>
        </div>
        <button className="nk-btn nk-btn-ghost" onClick={exportarExcel} disabled={gastos.length === 0}>⬇ Excel</button>
      </div>

      <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="nk-gastos-mes" />

      <form className="nk-card nk-gastos-form" onSubmit={handleSubmit}>
        <div className="nk-field">
          <label>Fecha</label>
          <input type="date" required value={fecha} min={desde} max={hasta} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="nk-field nk-gastos-campo-grande">
          <label>Descripción</label>
          <input
            ref={descripcionRef}
            list="gastos-sugerencias"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: GASTO COMIDA, PAGO ALQUILER, CUOTA CASHEA…"
          />
          <datalist id="gastos-sugerencias">
            {sugerencias.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
        <div className="nk-field">
          <label>Monto ($)</label>
          <input type="number" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div className="nk-gastos-form-acciones">
          {editandoId && (
            <button type="button" className="nk-btn nk-btn-ghost" onClick={limpiarFormulario}>Cancelar</button>
          )}
          <button type="submit" className="nk-btn nk-btn-primary" disabled={guardando}>
            {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : '+ Agregar gasto'}
          </button>
        </div>
      </form>

      {error && <p className="nk-error-text" role="alert" style={{ margin: '0 0 12px' }}>{error}</p>}

      <div className="nk-card nk-gastos-table-wrap">
        {cargando ? (
          <p style={{ padding: 24, color: 'var(--nk-ink-soft)' }}>Cargando gastos…</p>
        ) : (
          <table className="nk-clientes-table">
            <thead>
              <tr><th>Fecha</th><th>Descripción</th><th>Monto</th><th>Acumulado</th><th></th></tr>
            </thead>
            <tbody>
              {conAcumulado.map((g) => (
                <tr key={g.id} className={editandoId === g.id ? 'nk-gastos-fila-editando' : ''}>
                  <td>{new Date(g.fecha + 'T00:00:00').toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}</td>
                  <td>{g.descripcion}</td>
                  <td className="nk-users-mono">${Number(g.monto).toFixed(2)}</td>
                  <td className="nk-users-mono">${g.acumulado.toFixed(2)}</td>
                  <td className="nk-clientes-acciones">
                    <button className="nk-btn nk-btn-ghost" onClick={() => iniciarEdicion(g)}>Editar</button>
                    <button className="nk-btn nk-btn-danger" onClick={() => eliminar(g)}>Eliminar</button>
                  </td>
                </tr>
              ))}
              {conAcumulado.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--nk-ink-faint)' }}>
                  No hay gastos registrados este mes.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}