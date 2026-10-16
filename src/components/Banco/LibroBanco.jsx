import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import * as XLSX from 'xlsx'
import MovimientoBancoForm from './MovimientoBancoForm'

const CONFIG = {
  bs: { moneda: 'Bs.', archivo: 'Banco Bs' },
  usd: { moneda: '$', archivo: 'Banco USDT y efectivo' },
}

const ultimoDiaDelMes = (mes) => {
  const [año, m] = mes.split('-').map(Number)
  return `${mes}-${String(new Date(año, m, 0).getDate()).padStart(2, '0')}`
}

export default function LibroBanco({ cuenta, mes }) {
  const { moneda, archivo } = CONFIG[cuenta]
  const fmt = (n) => `${moneda}${Number(n).toFixed(2)}`

  const [movimientos, setMovimientos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [movimientoEditando, setMovimientoEditando] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const { data, error } = await supabase.from('movimientos_banco').select('*')
      .eq('cuenta', cuenta)
      .order('fecha').order('creado_en')
    if (error) setError(error.message)
    else setMovimientos(data ?? [])
    setCargando(false)
  }, [cuenta])

  useEffect(() => { cargar() }, [cargar])

  // Saldo acumulado corrido sobre TODO el historial de esta cuenta
  const conSaldo = useMemo(() => {
    let saldo = 0
    return movimientos.map((m) => {
      saldo = Math.round((saldo + Number(m.debe) - Number(m.haber)) * 100) / 100
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
    XLSX.writeFile(libro, `Nina's Kids - ${archivo} ${etiquetaMes}.xlsx`)
  }

  return (
    <div>
      <div className="nk-banco-header">
        <p style={{ color: 'var(--nk-ink-soft)', margin: 0 }}>
          Saldo actual: <strong>{fmt(saldoFinal)}</strong>
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="nk-btn nk-btn-ghost" onClick={exportarExcel}>⬇ Excel</button>
          <button className="nk-btn nk-btn-primary" onClick={abrirNuevo}>+ Nuevo movimiento</button>
        </div>
      </div>

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
                <td className="nk-users-mono"><strong>{fmt(saldoVienen)}</strong></td>
                <td></td>
              </tr>
              {movimientosDelMes.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}</td>
                  <td>{m.descripcion}</td>
                  <td className="nk-users-mono">{Number(m.debe) > 0 ? fmt(m.debe) : '—'}</td>
                  <td className="nk-users-mono" style={{ color: Number(m.haber) > 0 ? 'var(--nk-coral)' : undefined }}>
                    {Number(m.haber) > 0 ? `-${fmt(m.haber)}` : '—'}
                  </td>
                  <td className="nk-users-mono">{fmt(m.saldoAcumulado)}</td>
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
          cuenta={cuenta}
          onCerrar={() => setMostrarForm(false)}
          onGuardado={() => { setMostrarForm(false); cargar() }}
        />
      )}
    </div>
  )
}