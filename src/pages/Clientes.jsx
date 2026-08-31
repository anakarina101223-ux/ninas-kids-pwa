import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import ClienteForm from '../components/Clientes/ClienteForm'
import './Clientes.css'

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [notasCredito, setNotasCredito] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [clienteEditando, setClienteEditando] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [{ data: v, error: e1 }, { data: n, error: e2 }] = await Promise.all([
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('notas_credito').select('cliente_id, saldo_disponible').gt('saldo_disponible', 0),
    ])
    if (e1 || e2) setError((e1 || e2).message)
    setClientes(v ?? [])
    setNotasCredito(n ?? [])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.telefono ?? '').includes(busqueda)
  )

  const abrirNuevo = () => { setClienteEditando(null); setMostrarForm(true) }
  const abrirEditar = (c) => { setClienteEditando(c); setMostrarForm(true) }

  const eliminar = async (c) => {
    if (!confirm(`¿Eliminar a "${c.nombre}"? Esto también eliminará su historial de ventas.`)) return
    const { error } = await supabase.from('clientes').delete().eq('id', c.id)
    if (error) setError(error.message)
    else cargar()
  }

  const saldoCredito = (clienteId) =>
    notasCredito.filter((n) => n.cliente_id === clienteId).reduce((sum, n) => sum + Number(n.saldo_disponible), 0)

  return (
    <div>
      <div className="nk-clientes-header">
        <div>
          <h1>Clientes</h1>
          <p style={{ color: 'var(--nk-ink-soft)', margin: '4px 0 0' }}>{filtrados.length} registrados</p>
        </div>
        <button className="nk-btn nk-btn-primary" onClick={abrirNuevo}>+ Nuevo cliente</button>
      </div>

      <input
        className="nk-clientes-buscador"
        placeholder="Buscar por nombre o teléfono…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {error && <p className="nk-error-text" role="alert" style={{ margin: '12px 0' }}>{error}</p>}

      <div className="nk-card nk-clientes-table-wrap">
        {cargando ? (
          <p style={{ padding: 24, color: 'var(--nk-ink-soft)' }}>Cargando clientes…</p>
        ) : (
          <table className="nk-clientes-table">
            <thead>
              <tr><th>Nombre</th><th>Teléfono</th><th>Dirección</th><th>Crédito</th><th></th></tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id}>
                  <td>{c.nombre}</td>
                  <td className="nk-users-mono">{c.telefono || '—'}</td>
                  <td>{c.direccion || '—'}</td>
                  <td>
                    {saldoCredito(c.id) > 0 && (
                      <span className="nk-chip nk-chip-marigold">${saldoCredito(c.id).toFixed(2)}</span>
                    )}
                  </td>
                  <td className="nk-clientes-acciones">
                    <button className="nk-btn nk-btn-ghost" onClick={() => abrirEditar(c)}>Editar</button>
                    <button className="nk-btn nk-btn-danger" onClick={() => eliminar(c)}>Eliminar</button>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--nk-ink-faint)' }}>
                  No hay clientes que coincidan.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {mostrarForm && (
        <ClienteForm
          cliente={clienteEditando}
          onCerrar={() => setMostrarForm(false)}
          onGuardado={() => { setMostrarForm(false); cargar() }}
        />
      )}
    </div>
  )
}