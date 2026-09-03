import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import * as XLSX from 'xlsx'
import MovimientoBancoForm from '../components/Banco/MovimientoBancoForm'
import './Banco.css'

const mesActualISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const ultimoDiaDelMes = (mes) => {
  const [año, mesNum] = mes.split('-').map(Number)
  return new Date(año, mesNum, 0).toISOString().slice(0, 10)
}

export default function Banco() {
  const [movimientos, setMovimientos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mes, setMes] = useState(mesActualISO())
  const [mostrarForm, setMostrarForm] = useState(false)
  const [movimientoEditando, setMovimientoEditando] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const { data, error } = await supabase.from('movimientos_banco').select('*').order('fecha').order('creado_en')
    if (error) setError(error.message)
    else setMovimientos(data ?? [])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Saldo acumulado corrido sobre TODO el historial, igual que en la hoja de cálculo
  const conSaldo = useMemo(() => {
    let saldo = 0
    return movimientos.map((m) => {
      saldo += Number(m.debe) - Number(m.haber)
      return { ...m, saldoAcumulado: saldo }
    })
  }, [movimientos])

  const primerDia = `${mes}-01`
  const ultimoDia = ultimoDiaDelMes(mes)

  const saldoVienen = useMemo(() => {
    const anteriores = conSaldo.filter((m) => m.fecha < primerDia)
    return anteriores.length > 0 ? anteriores[anteriores.length - 1].saldoAcumulado : 0
  }, [conSaldo, primerDia])

  const movimientosDelMes = useMemo(
    () => conSaldo.filter((m) => m.fecha >= primerDia && m.fecha <= ultimoDia),
    [conSaldo, primerDia, ultimoDia]
  )

  const saldoFinal = movimientosDelMes.length > 0
    ? movimientosDelMes[movimientosDelMes.length - 1].saldoAcumulado
    : saldoVienen

  const abrirNuevo = () => { setMovimientoEditando(null); setMostrarForm(true) }
  const abrirEditar = (m) => { setMovimientoEditando(m); setMostrarForm(true) }

  const eliminar = async (m) => {
    if (!confirm(`¿Eliminar el movimiento "${m.descripcion}"?`)) return
    const { error } = await supabase.from('movimientos_banco').delete().eq('id', m.id)
    if (error) setError(error.message)
    else cargar()
  }

  const exportarExcel = () => {
    const filas = [
      { Fecha: '', Descripción: 'VIENEN', Debe: '', Haber: '', Saldo: saldoVienen },
      ...movimientosDelMes.map((m) => ({
        Fecha: new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-VE'),
        Descripción: m.descripcion,
        Debe: Number(m.debe) > 0 ? Number(m.debe) : '',
        Haber: Number(m.haber) > 0 ? -Number(m.haber) : '',
        Saldo: m.saldoAcumulado,
      })),
    ]
    const hoja = XLSX.utils.json_to_sheet(filas)
    const libro = XLSX.utils.book_new()
    const etiquetaMes = new Date(`${mes}-01T00:00:00`).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })
    XLSX.utils.book_append_sheet(libro, hoja, etiquetaMes)
    XLSX.writeFile(libro, `Nina's Kids - Banco ${etiquetaMes}.xlsx`)
  }

  return (
    <div>
      <div className="nk-banco-header">
        <div>
          <h1>Banco</h1>
          <p style={{ color: 'var(--nk-ink-soft)', margin: '4px 0 0' }}>
            Saldo actual: <strong>Bs.{saldoFinal.toFixed(2)}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="nk-btn nk-btn-ghost" onClick={exportarExcel}>⬇ Excel</button>
          <button className="nk-btn nk-btn-primary" onClick={abrirNuevo}>+ Nuevo movimiento</button>
        </div>
      </div>

      <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="nk-banco-mes" />

      {error && <p className="nk-error-text" role="alert" style={{ margin: '12px 0' }}>{error}</p>}

      <div className="nk-card nk-banco-table-wrap">
        {cargando ? (
          <p style={{ padding: 24, color: 'var(--nk-ink-soft)' }}>Cargando movimientos…</p>
        ) : (
          <table className="nk-clientes-table">
            <thead>
              <tr><th>Fecha</th><th>Descripción</th><th>Debe</th><th>Haber</th><th>Saldo</th><th></th></tr>
            </thead>
            <tbody>
              <tr className="nk-banco-vienen">
                <td></td>
                <td><strong>VIENEN</strong></td>
                <td></td>
                <td></td>
                <td className="nk-users-mono"><strong>Bs.{saldoVienen.toFixed(2)}</strong></td>
                <td></td>
              </tr>
              {movimientosDelMes.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}</td>
                  <td>{m.descripcion}</td>
                  <td className="nk-users-mono">{Number(m.debe) > 0 ? `Bs.${Number(m.debe).toFixed(2)}` : '—'}</td>
                  <td className="nk-users-mono" style={{ color: Number(m.haber) > 0 ? 'var(--nk-coral)' : undefined }}>
                    {Number(m.haber) > 0 ? `Bs.-${Number(m.haber).toFixed(2)}` : '—'}
                  </td>
                  <td className="nk-users-mono">Bs.{m.saldoAcumulado.toFixed(2)}</td>
                  <td className="nk-clientes-acciones">
                    <button className="nk-btn nk-btn-ghost" onClick={() => abrirEditar(m)}>Editar</button>
                    <button className="nk-btn nk-btn-danger" onClick={() => eliminar(m)}>Eliminar</button>
                  </td>
                </tr>
              ))}
              {movimientosDelMes.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--nk-ink-faint)' }}>
                  No hay movimientos registrados este mes.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {mostrarForm && (
        <MovimientoBancoForm
          movimiento={movimientoEditando}
          onCerrar={() => setMostrarForm(false)}
          onGuardado={() => { setMostrarForm(false); cargar() }}
        />
      )}
    </div>
  )
}