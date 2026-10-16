import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import './CuadreCaja.css'

const hoyISO = () => new Date().toLocaleDateString('en-CA')
const r2 = (n) => Math.round(n * 100) / 100
const usd = (n) => `${n < 0 ? '-' : ''}$${Math.abs(Number(n)).toFixed(2)}`

const VACIO = { ventasContado: 0, abonos: 0, ventasCredito: 0, pagos: { bs: 0, usdt: 0, efectivo: 0, zelle: 0 } }

// Reparte lo cobrado en el día por método. PM/Transferencia y Tarjeta cuentan como Bs (entran al banco).
const calcularDelDia = (ventas, abonos) => {
  const pagos = { bs: 0, usdt: 0, efectivo: 0, zelle: 0 }
  let ventasContado = 0
  let ventasCredito = 0
  let totalAbonos = 0

  const sumar = (metodo, monto) => {
    const clave = ['efectivo', 'usdt', 'zelle'].includes(metodo) ? metodo : 'bs'
    pagos[clave] += monto
  }

  for (const v of ventas) {
    const monto = Number(v.total)
    // Una venta con cuenta por cobrar es una venta a crédito: no se cobró ese día
    if ((v.cuentas_por_cobrar ?? []).length > 0) { ventasCredito += monto; continue }
    ventasContado += monto
    if (v.metodo_pago === 'mixto') {
      for (const p of v.venta_pagos ?? []) sumar(p.metodo, Number(p.monto))
    } else {
      sumar(v.metodo_pago, monto)
    }
  }

  for (const a of abonos) {
    const monto = Number(a.monto)
    totalAbonos += monto
    sumar(a.metodo_pago, monto)
  }

  return {
    ventasContado: r2(ventasContado),
    abonos: r2(totalAbonos),
    ventasCredito: r2(ventasCredito),
    pagos: { bs: r2(pagos.bs), usdt: r2(pagos.usdt), efectivo: r2(pagos.efectivo), zelle: r2(pagos.zelle) },
  }
}

function Fila({ etiqueta, valor, bs, fuerte, sub, resalte, alerta }) {
  const clases = ['nk-cuadre-linea']
  if (fuerte) clases.push('nk-cuadre-linea-total')
  if (sub) clases.push('nk-cuadre-linea-sub')
  if (resalte) clases.push('nk-cuadre-linea-resalte')
  if (alerta) clases.push('nk-cuadre-diferencia')
  return (
    <div className={clases.join(' ')}>
      <span>{etiqueta}</span>
      <span>
        {valor}
        {bs && <span className="nk-cuadre-bs"> · Bs {bs}</span>}
      </span>
    </div>
  )
}

export default function CuadreCaja() {
  const [fecha, setFecha] = useState(hoyISO())
  const [auto, setAuto] = useState(VACIO)
  const [cuadre, setCuadre] = useState(null)
  const [tasa, setTasa] = useState(null)
  const [tasaInput, setTasaInput] = useState('')

  const [fondo, setFondo] = useState('')
  const [sueldos, setSueldos] = useState('')
  const [extra, setExtra] = useState([])
  const [efectivoContado, setEfectivoContado] = useState('')
  const [notas, setNotas] = useState('')

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardandoTasa, setGuardandoTasa] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')

    // Rango del día en hora local (convertido a UTC)
    const inicio = new Date(`${fecha}T00:00:00`).toISOString()
    const fin = new Date(`${fecha}T23:59:59.999`).toISOString()

    const [{ data: ventas }, { data: abonos }, { data: tasaDelDia }, { data: existente }, { data: previo }] = await Promise.all([
      supabase.from('ventas')
        .select('id, total, metodo_pago, cuentas_por_cobrar(id), venta_pagos(metodo, monto)')
        .gte('fecha', inicio).lte('fecha', fin),
      supabase.from('abonos').select('monto, metodo_pago').gte('fecha', inicio).lte('fecha', fin),
      supabase.from('tasas_cambio').select('*').eq('fecha', fecha).maybeSingle(),
      supabase.from('cuadres_diarios').select('*').eq('fecha', fecha).maybeSingle(),
      supabase.from('cuadres_diarios').select('fondo_caja').lt('fecha', fecha).order('fecha', { ascending: false }).limit(1).maybeSingle(),
    ])

    setAuto(calcularDelDia(ventas ?? [], abonos ?? []))
    setTasa(tasaDelDia ?? null)
    setTasaInput(tasaDelDia ? tasaDelDia.valor : '')
    setCuadre(existente ?? null)
    setFondo(existente ? existente.fondo_caja : (previo?.fondo_caja ?? ''))
    setSueldos(existente ? existente.sueldos : '')
    setExtra(existente?.egresos_extra ?? [])
    setEfectivoContado(existente?.efectivo_contado ?? '')
    setNotas(existente?.notas ?? '')
    setCargando(false)
  }, [fecha])

  useEffect(() => { cargar() }, [cargar])

  // ---------- Cálculos ----------
  const soloLectura = Boolean(cuadre?.cerrado)
  const datos = soloLectura && cuadre.snapshot ? cuadre.snapshot : auto
  const { ventasContado, abonos, ventasCredito, pagos } = datos

  const ingresosBruto = r2(ventasContado + abonos + ventasCredito)
  const ingresosNetos = ingresosBruto
  const cobrado = r2(pagos.bs + pagos.usdt + pagos.efectivo + pagos.zelle)
  const sinDesglosar = Math.max(0, r2(ventasContado + abonos - cobrado)) // pagos mixtos antiguos sin desglose

  const sueldosNum = Number(sueldos) || 0
  const extraValido = extra.filter((e) => Number(e.monto) > 0)
  const extraTotal = r2(extraValido.reduce((s, e) => s + Number(e.monto), 0))

  // Lo que no es efectivo en caja: banco Bs, Zelle, USDT y lo que quedó a crédito
  const totalEgresos = r2(pagos.bs + pagos.zelle + pagos.usdt + ventasCredito + sinDesglosar + sueldosNum + extraTotal)
  const ventaNetaEfectivo = r2(ingresosNetos - totalEgresos)

  const fondoNum = Number(fondo) || 0
  const efectivoEsperado = r2(fondoNum + ventaNetaEfectivo)
  const contadoNum = efectivoContado === '' ? null : Number(efectivoContado)
  const diferencia = contadoNum === null ? null : r2(contadoNum - efectivoEsperado)

  const bsDe = (monto) => (tasa ? (monto * tasa.valor).toFixed(2) : undefined)

  // ---------- Acciones ----------
  const agregarExtra = () => setExtra((prev) => [...prev, { descripcion: '', monto: '' }])
  const quitarExtra = (i) => setExtra((prev) => prev.filter((_, idx) => idx !== i))
  const cambiarExtra = (i, campo, valor) =>
    setExtra((prev) => prev.map((e, idx) => (idx === i ? { ...e, [campo]: valor } : e)))

  const handleGuardar = async (cerrando) => {
    setGuardando(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('cuadres_diarios').upsert({
      fecha,
      usuario_id: user.id,
      fondo_caja: fondoNum,
      sueldos: sueldosNum,
      egresos_extra: extraValido.map((e) => ({ descripcion: e.descripcion.trim(), monto: Number(e.monto) })),
      efectivo_contado: contadoNum,
      notas: notas.trim() || null,
      cerrado: cerrando,
      snapshot: cerrando ? auto : null, // al cerrar se congelan las cifras del día
    }, { onConflict: 'fecha' })

    setGuardando(false)
    if (error) { setError(error.message); return }
    await cargar()
  }

  const handleReabrir = async () => {
    if (!confirm('¿Reabrir este cuadre? Volverá a calcularse con los datos actuales del sistema.')) return
    const { error } = await supabase.from('cuadres_diarios').update({ cerrado: false, snapshot: null }).eq('id', cuadre.id)
    if (error) setError(error.message)
    else cargar()
  }

  const handleGuardarTasa = async () => {
    const valor = Number(tasaInput)
    if (!valor || valor <= 0) return
    setGuardandoTasa(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('tasas_cambio')
      .upsert({ fecha, valor, actualizado_por: user.id, actualizado_en: new Date().toISOString() }, { onConflict: 'fecha' })
    setGuardandoTasa(false)
    if (error) setError(error.message)
    else setTasa({ fecha, valor })
  }

  return (
    <div>
      <div className="nk-cuadre-header">
        <h1>Cuadre de caja chica</h1>
        <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
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

      {error && <p className="nk-error-text" role="alert" style={{ marginBottom: 12 }}>{error}</p>}

      {cargando ? (
        <p style={{ color: 'var(--nk-ink-soft)' }}>Cargando…</p>
      ) : (
        <div className="nk-card nk-cuadre-doc">
          {/* ---------- INGRESOS ---------- */}
          <div className="nk-cuadre-seccion nk-cuadre-seccion-ingresos">Ingresos</div>
          <div className="nk-cuadre-cuerpo">
            <Fila etiqueta="Ventas de contado" valor={usd(ventasContado)} />
            <Fila etiqueta="Abonos" valor={usd(abonos)} />
            <Fila etiqueta="Ventas a crédito" valor={usd(ventasCredito)} />
            <Fila etiqueta="Total ingresos bruto" valor={usd(ingresosBruto)} fuerte />

            <Fila sub etiqueta="Pagos Bs" valor={usd(pagos.bs)} bs={bsDe(pagos.bs)} />
            <Fila sub etiqueta="Pagos USDT" valor={usd(pagos.usdt)} />
            <Fila sub etiqueta="Pagos efectivo" valor={usd(pagos.efectivo)} />
            <Fila sub etiqueta="Pagos en Zelle" valor={usd(pagos.zelle)} />

            <Fila etiqueta="Ingresos netos" valor={usd(ingresosNetos)} fuerte />
          </div>

          {/* ---------- EGRESOS ---------- */}
          <div className="nk-cuadre-seccion nk-cuadre-seccion-egresos">Egresos</div>
          <div className="nk-cuadre-cuerpo">
            <div className="nk-cuadre-linea">
              <span>Sueldos y salarios</span>
              <input className="nk-cuadre-input" type="number" step="0.01" min="0" disabled={soloLectura}
                value={sueldos} onChange={(e) => setSueldos(e.target.value)} />
            </div>
            <Fila etiqueta="Saldo en banco Bs" valor={usd(pagos.bs)} bs={bsDe(pagos.bs)} />
            <Fila etiqueta="Zelle" valor={usd(pagos.zelle)} />
            <Fila etiqueta="USDT" valor={usd(pagos.usdt)} />
            <Fila etiqueta="Venta crédito" valor={usd(ventasCredito)} />
            {sinDesglosar > 0 && <Fila etiqueta="Pagos mixtos sin desglosar" valor={usd(sinDesglosar)} />}

            {extra.map((e, i) => (
              <div key={i} className="nk-cuadre-extra">
                <input placeholder="Otro egreso (descripción)" disabled={soloLectura}
                  value={e.descripcion} onChange={(ev) => cambiarExtra(i, 'descripcion', ev.target.value)} />
                <input type="number" step="0.01" min="0" placeholder="0.00" disabled={soloLectura}
                  value={e.monto} onChange={(ev) => cambiarExtra(i, 'monto', ev.target.value)} />
                {!soloLectura && (
                  <button type="button" className="nk-btn nk-btn-ghost" onClick={() => quitarExtra(i)}>✕</button>
                )}
              </div>
            ))}
            {!soloLectura && (
              <button type="button" className="nk-btn nk-btn-ghost" style={{ marginTop: 8 }} onClick={agregarExtra}>
                + Otro egreso
              </button>
            )}

            <Fila etiqueta="Total egresos" valor={usd(totalEgresos)} fuerte />
            <Fila etiqueta="Total venta neta efectivo" valor={usd(ventaNetaEfectivo)} fuerte resalte />
          </div>

          {/* ---------- CAJA ---------- */}
          <div className="nk-cuadre-seccion nk-cuadre-seccion-caja">Caja</div>
          <div className="nk-cuadre-cuerpo">
            <div className="nk-cuadre-linea">
              <span>Fondo de caja</span>
              <input className="nk-cuadre-input" type="number" step="0.01" min="0" disabled={soloLectura}
                value={fondo} onChange={(e) => setFondo(e.target.value)} />
            </div>
            <Fila etiqueta="Efectivo esperado en caja" valor={usd(efectivoEsperado)} fuerte />
            <div className="nk-cuadre-linea">
              <span>Efectivo contado</span>
              <input className="nk-cuadre-input" type="number" step="0.01" min="0" disabled={soloLectura}
                value={efectivoContado} onChange={(e) => setEfectivoContado(e.target.value)} />
            </div>
            {diferencia !== null && (
              <Fila
                etiqueta="Diferencia"
                valor={`${diferencia > 0 ? '+' : ''}${usd(diferencia)}`}
                fuerte
                alerta={diferencia !== 0}
              />
            )}

            <div className="nk-field" style={{ marginTop: 12 }}>
              <label>Notas (opcional)</label>
              <input disabled={soloLectura} value={notas} onChange={(e) => setNotas(e.target.value)} />
            </div>

            <div className="nk-cuadre-acciones">
              {soloLectura ? (
                <>
                  <span className="nk-chip nk-chip-green">Cuadre cerrado</span>
                  <button className="nk-btn nk-btn-ghost" onClick={handleReabrir}>Reabrir</button>
                </>
              ) : (
                <>
                  <button className="nk-btn nk-btn-ghost" disabled={guardando} onClick={() => handleGuardar(false)}>
                    Guardar borrador
                  </button>
                  <button className="nk-btn nk-btn-primary" disabled={guardando || contadoNum === null}
                    onClick={() => handleGuardar(true)}>
                    Cerrar cuadre del día
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}