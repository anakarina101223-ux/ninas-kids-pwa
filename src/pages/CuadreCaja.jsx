import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import './CuadreCaja.css'

const hoyISO = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD en hora local

export default function CuadreCaja() {
  const [fecha, setFecha] = useState(hoyISO())
  const [cuadre, setCuadre] = useState(null)
  const [resumenVentas, setResumenVentas] = useState({ efectivo: 0, pago_movil: 0, transferencia: 0, tarjeta: 0, mixto: 0 })
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [tasa, setTasa] = useState(null) // fila de tasas_cambio del día, o null si no se ha puesto
const [tasaInput, setTasaInput] = useState('')
const [guardandoTasa, setGuardandoTasa] = useState(false)

  const [form, setForm] = useState({
    efectivo_inicial: '', otros_ingresos: '', otros_ingresos_desc: '',
    egresos: '', egresos_desc: '', efectivo_contado: '', notas: '',
  })

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')

    const inicioDia = `${fecha}T00:00:00`
    const finDia = `${fecha}T23:59:59`

    const [{ data: existente }, { data: ventasDelDia }, { data: abonosDelDia }, { data: tasaDelDia }] = await Promise.all([
      supabase.from('cuadres_caja').select('*').eq('fecha', fecha).maybeSingle(),
      supabase.from('ventas').select('total, metodo_pago').gte('fecha', inicioDia).lte('fecha', finDia),
      supabase.from('abonos').select('monto, metodo_pago').gte('fecha', inicioDia).lte('fecha', finDia),
      supabase.from('tasas_cambio').select('*').eq('fecha', fecha).maybeSingle(),
    ])

    const resumen = { efectivo: 0, pm_transferencia: 0, usdt: 0, tarjeta: 0, mixto: 0 }
    for (const v of ventasDelDia ?? []) resumen[v.metodo_pago] += Number(v.total)
    for (const a of abonosDelDia ?? []) resumen[a.metodo_pago] += Number(a.monto)
    setResumenVentas(resumen)

    if (existente) {
      setCuadre(existente)
      setForm({
        efectivo_inicial: existente.efectivo_inicial,
        otros_ingresos: existente.otros_ingresos,
        otros_ingresos_desc: existente.otros_ingresos_desc ?? '',
        egresos: existente.egresos,
        egresos_desc: existente.egresos_desc ?? '',
        efectivo_contado: existente.efectivo_contado ?? '',
        notas: existente.notas ?? '',
      })
    } else {
      setCuadre(null)
      setForm({ efectivo_inicial: '', otros_ingresos: '', otros_ingresos_desc: '', egresos: '', egresos_desc: '', efectivo_contado: '', notas: '' })
    }
    setTasa(tasaDelDia ?? null)
    setTasaInput(tasaDelDia ? tasaDelDia.valor : '')
    setCargando(false)
  }, [fecha])

  useEffect(() => { cargar() }, [cargar])

  const ventasEfectivo = resumenVentas.efectivo
  const efectivoInicial = Number(form.efectivo_inicial) || 0
  const otrosIngresos = Number(form.otros_ingresos) || 0
  const egresos = Number(form.egresos) || 0
  const efectivoContado = form.efectivo_contado === '' ? null : Number(form.efectivo_contado)

  const efectivoEsperado = efectivoInicial + ventasEfectivo + otrosIngresos - egresos
  const diferencia = efectivoContado === null ? null : efectivoContado - efectivoEsperado

  const handleGuardar = async (cerrando) => {
    setGuardando(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const payload = {
        fecha,
        usuario_id: user.id,
        efectivo_inicial: efectivoInicial,
        ventas_efectivo: ventasEfectivo,
        ventas_pago_movil: resumenVentas.pm_transferencia,
        ventas_transferencia: 0,
        ventas_usdt: resumenVentas.usdt,
        ventas_tarjeta: resumenVentas.tarjeta,
        otros_ingresos: otrosIngresos,
        otros_ingresos_desc: form.otros_ingresos_desc || null,
        egresos: egresos,
        egresos_desc: form.egresos_desc || null,
        efectivo_contado: efectivoContado,
        notas: form.notas || null,
        cerrado: cerrando,
      }

      const { error } = cuadre
        ? await supabase.from('cuadres_caja').update(payload).eq('id', cuadre.id)
        : await supabase.from('cuadres_caja').insert(payload)

      if (error) throw error
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const handleGuardarTasa = async () => {
    const valor = Number(tasaInput)
    if (!valor || valor <= 0) return

    setGuardandoTasa(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('tasas_cambio')
        .upsert({ fecha, valor, actualizado_por: user.id, actualizado_en: new Date().toISOString() }, { onConflict: 'fecha' })

    setGuardandoTasa(false)
    if (!error) {
        setTasa({ fecha, valor })
    } else {
        setError(error.message)
    }
  }

  const soloLectura = cuadre?.cerrado

  return (
    <div>
      <div className="nk-cuadre-header">
        <h1>Cuadre de caja</h1>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>

      <div className="nk-card nk-tasa-card">
        <span className="nk-inv-card-meta">Tasa del día (Bs/USD)</span>
        <div className="nk-tasa-input-row">
            <input
            type="number" step="0.0001" min="0.0001"
            value={tasaInput}
            onChange={(e) => setTasaInput(e.target.value)}
            placeholder="Ej: 55.30"
            />
            <button className="nk-btn nk-btn-primary" disabled={guardandoTasa} onClick={handleGuardarTasa}>
            {guardandoTasa ? 'Guardando…' : 'Guardar tasa'}
            </button>
        </div>
        {tasa && <span className="nk-chip nk-chip-marigold">Vigente: {Number(tasa.valor).toFixed(4)} Bs</span>}
      </div>

      {cargando ? (
        <p style={{ color: 'var(--nk-ink-soft)' }}>Cargando…</p>
      ) : (
        <div className="nk-cuadre-layout">
          <div className="nk-card nk-cuadre-resumen">
            <h3>Ventas del día (automático)</h3>
            <hr className="nk-stitch" style={{ margin: '10px 0' }} />
            <div className="nk-cuadre-linea"><span>Efectivo</span><span>${ventasEfectivo.toFixed(2)}</span></div>
            <div className="nk-cuadre-linea">
              <span>PM / Transferencia</span>
              <span>
                ${resumenVentas.pm_transferencia.toFixed(2)}
                {tasa && <span className="nk-cuadre-bs"> · Bs {(resumenVentas.pm_transferencia * tasa.valor).toFixed(2)}</span>}
              </span>
            </div>
            <div className="nk-cuadre-linea"><span>USDT</span><span>${resumenVentas.usdt.toFixed(2)}</span></div>
            <div className="nk-cuadre-linea"><span>Tarjeta</span><span>${resumenVentas.tarjeta.toFixed(2)}</span></div>
            <div className="nk-cuadre-linea"><span>Mixto</span><span>${resumenVentas.mixto.toFixed(2)}</span></div>
            <hr className="nk-stitch" style={{ margin: '10px 0' }} />
            <div className="nk-cuadre-linea nk-cuadre-linea-total">
              <span>Total del día</span>
              <span>${Object.values(resumenVentas).reduce((a, b) => a + b, 0).toFixed(2)}</span>
            </div>
            <p className="nk-inv-card-meta" style={{ marginTop: 8 }}>
              Incluye ventas y abonos a cuentas por cobrar recibidos en el día.
            </p>
          </div>

          <div className="nk-card nk-cuadre-form">
            <h3>Cierre de caja</h3>
            <hr className="nk-stitch" style={{ margin: '10px 0 16px' }} />

            <div className="nk-producto-form">
              <div className="nk-producto-form-row">
                <div className="nk-field">
                  <label>Efectivo inicial</label>
                  <input type="number" step="0.01" min="0" disabled={soloLectura}
                    value={form.efectivo_inicial} onChange={(e) => setForm({ ...form, efectivo_inicial: e.target.value })} />
                </div>
                <div className="nk-field">
                  <label>Efectivo contado (cierre)</label>
                  <input type="number" step="0.01" min="0" disabled={soloLectura}
                    value={form.efectivo_contado} onChange={(e) => setForm({ ...form, efectivo_contado: e.target.value })} />
                </div>
              </div>

              <div className="nk-producto-form-row">
                <div className="nk-field">
                  <label>Otros ingresos</label>
                  <input type="number" step="0.01" min="0" disabled={soloLectura}
                    value={form.otros_ingresos} onChange={(e) => setForm({ ...form, otros_ingresos: e.target.value })} />
                </div>
                <div className="nk-field">
                  <label>Descripción</label>
                  <input disabled={soloLectura} value={form.otros_ingresos_desc}
                    onChange={(e) => setForm({ ...form, otros_ingresos_desc: e.target.value })} placeholder="Ej: abono de cliente en efectivo aparte" />
                </div>
              </div>

              <div className="nk-producto-form-row">
                <div className="nk-field">
                  <label>Egresos (gastos del día)</label>
                  <input type="number" step="0.01" min="0" disabled={soloLectura}
                    value={form.egresos} onChange={(e) => setForm({ ...form, egresos: e.target.value })} />
                </div>
                <div className="nk-field">
                  <label>Descripción</label>
                  <input disabled={soloLectura} value={form.egresos_desc}
                    onChange={(e) => setForm({ ...form, egresos_desc: e.target.value })} placeholder="Ej: pago a domicilio, compra de bolsas" />
                </div>
              </div>

              <div className="nk-field">
                <label>Notas (opcional)</label>
                <input disabled={soloLectura} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
              </div>
            </div>

            <hr className="nk-stitch" style={{ margin: '16px 0' }} />

            <div className="nk-cuadre-linea"><span>Efectivo esperado</span><span>${efectivoEsperado.toFixed(2)}</span></div>
            {efectivoContado !== null && (
              <div className={`nk-cuadre-linea nk-cuadre-linea-total ${diferencia !== 0 ? 'nk-cuadre-diferencia' : ''}`}>
                <span>Diferencia</span>
                <span>{diferencia >= 0 ? '+' : ''}${diferencia.toFixed(2)}</span>
              </div>
            )}

            {error && <p className="nk-error-text" role="alert" style={{ marginTop: 10 }}>{error}</p>}

            {soloLectura ? (
              <p className="nk-chip nk-chip-green" style={{ marginTop: 16 }}>Cuadre cerrado</p>
            ) : (
              <div className="nk-producto-form-actions" style={{ marginTop: 16 }}>
                <button className="nk-btn nk-btn-ghost" disabled={guardando} onClick={() => handleGuardar(false)}>
                  Guardar borrador
                </button>
                <button className="nk-btn nk-btn-primary" disabled={guardando || efectivoContado === null} onClick={() => handleGuardar(true)}>
                  Cerrar caja del día
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}