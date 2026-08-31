import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import './UsersManagement.css'

const ROLES = [
  { value: 'gerente', label: 'Gerente' },
  { value: 'super_admin', label: 'Super admin' },
]

const FORM_VACIO = { nombre: '', correo: '', contrasena: '', rol: 'gerente' }

export default function UsersManagement() {
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)

  const cargarUsuarios = useCallback(async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, correo, rol, activo, creado_en')
      .order('creado_en', { ascending: false })

    if (error) setError(error.message)
    else setUsuarios(data)
    setCargando(false)
  }, [])

  useEffect(() => { cargarUsuarios() }, [cargarUsuarios])

  const handleCrear = async (e) => {
    e.preventDefault()
    setError('')
    setGuardando(true)

    const { data: sessionData } = await supabase.auth.getSession()
    const { error } = await supabase.functions.invoke('manage-users', {
      body: { accion: 'crear', ...form },
      headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
    })

    setGuardando(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm(FORM_VACIO)
    setMostrarForm(false)
    cargarUsuarios()
  }

  const toggleActivo = async (usuario) => {
    const { error } = await supabase
      .from('usuarios')
      .update({ activo: !usuario.activo })
      .eq('id', usuario.id)
    if (error) setError(error.message)
    else cargarUsuarios()
  }

  const cambiarRol = async (usuario, nuevoRol) => {
    const { error } = await supabase
      .from('usuarios')
      .update({ rol: nuevoRol })
      .eq('id', usuario.id)
    if (error) setError(error.message)
    else cargarUsuarios()
  }

  const eliminarUsuario = async (usuario) => {
    if (!confirm(`¿Eliminar a ${usuario.nombre}? Esta acción no se puede deshacer.`)) return

    const { data: sessionData } = await supabase.auth.getSession()
    const { error } = await supabase.functions.invoke('manage-users', {
      body: { accion: 'eliminar', id: usuario.id },
      headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
    })
    if (error) setError(error.message)
    else cargarUsuarios()
  }

  return (
    <div>
      <div className="nk-users-header">
        <div>
          <h1>Gestión de usuarios</h1>
          <p style={{ color: 'var(--nk-ink-soft)', margin: '4px 0 0' }}>
            Crea, edita el acceso y elimina cuentas del sistema.
          </p>
        </div>
        <button className="nk-btn nk-btn-primary" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Cancelar' : '+ Nuevo usuario'}
        </button>
      </div>

      {error && <p className="nk-error-text" role="alert" style={{ marginBottom: 16 }}>{error}</p>}

      {mostrarForm && (
        <form className="nk-card nk-users-form" onSubmit={handleCrear}>
          <div className="nk-field">
            <label htmlFor="nombre">Nombre completo</label>
            <input id="nombre" required value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          <div className="nk-field">
            <label htmlFor="correo">Correo</label>
            <input id="correo" type="email" required value={form.correo}
              onChange={(e) => setForm({ ...form, correo: e.target.value })} />
          </div>
          <div className="nk-field">
            <label htmlFor="contrasena">Contraseña temporal</label>
            <input id="contrasena" type="password" required minLength={6} value={form.contrasena}
              onChange={(e) => setForm({ ...form, contrasena: e.target.value })} />
          </div>
          <div className="nk-field">
            <label htmlFor="rol">Rol</label>
            <select id="rol" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <button type="submit" className="nk-btn nk-btn-primary" disabled={guardando} style={{ alignSelf: 'flex-end' }}>
            {guardando ? 'Creando…' : 'Crear usuario'}
          </button>
        </form>
      )}

      <div className="nk-card nk-users-table-wrap">
        {cargando ? (
          <p style={{ padding: 24, color: 'var(--nk-ink-soft)' }}>Cargando usuarios…</p>
        ) : (
          <table className="nk-users-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>{u.nombre}</td>
                  <td className="nk-users-mono">{u.correo}</td>
                  <td>
                    <select value={u.rol} onChange={(e) => cambiarRol(u, e.target.value)}>
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <button
                      className={`nk-chip ${u.activo ? 'nk-chip-green' : 'nk-chip-coral'}`}
                      style={{ border: 'none', cursor: 'pointer' }}
                      onClick={() => toggleActivo(u)}
                    >
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td>
                    <button className="nk-btn nk-btn-danger" onClick={() => eliminarUsuario(u)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--nk-ink-faint)' }}>
                  Aún no hay usuarios registrados.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}