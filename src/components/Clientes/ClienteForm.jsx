import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const VACIO = { nombre: '', telefono: '', direccion: '', notas: '' }

export default function ClienteForm({ cliente, onCerrar, onGuardado }) {
  const esEdicion = Boolean(cliente)
  const [form, setForm] = useState(cliente ? { ...VACIO, ...cliente } : VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setGuardando(true)

    const payload = {
      nombre: form.nombre,
      telefono: form.telefono || null,
      direccion: form.direccion || null,
      notas: form.notas || null,
    }

    const { error } = esEdicion
      ? await supabase.from('clientes').update(payload).eq('id', cliente.id)
      : await supabase.from('clientes').insert(payload)

    setGuardando(false)
    if (error) { setError(error.message); return }
    onGuardado()
  }

  return (
    <div className="nk-modal-overlay" onClick={onCerrar}>
      <div className="nk-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <h2>{esEdicion ? 'Editar cliente' : 'Nuevo cliente'}</h2>
        <hr className="nk-stitch" style={{ margin: '12px 0 20px' }} />

        <form onSubmit={handleSubmit} className="nk-producto-form">
          <div className="nk-field">
            <label>Nombre</label>
            <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          <div className="nk-field">
            <label>Teléfono</label>
            <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          </div>
          <div className="nk-field">
            <label>Dirección (opcional)</label>
            <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
          </div>
          <div className="nk-field">
            <label>Notas (opcional)</label>
            <input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          </div>

          {error && <p className="nk-error-text" role="alert">{error}</p>}

          <div className="nk-producto-form-actions">
            <button type="button" className="nk-btn nk-btn-ghost" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="nk-btn nk-btn-primary" disabled={guardando}>
              {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}