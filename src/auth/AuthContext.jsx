import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null) // fila de la tabla `usuarios`
  const [loading, setLoading] = useState(true)

  const cargarPerfil = useCallback(async (userId) => {
    if (!userId) {
      setPerfil(null)
      return
    }
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, rol, activo')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('[Auth] No se pudo cargar el perfil de usuario:', error.message)
      setPerfil(null)
      return
    }
    setPerfil(data)
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      setSession(session)
      if (session?.user) await cargarPerfil(session.user.id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.user) {
        await cargarPerfil(session.user.id)
      } else {
        setPerfil(null)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [cargarPerfil])

  const login = async (correo, contrasena) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: correo,
      password: contrasena,
    })
    if (error) return { error }

    const { data: perfilData, error: perfilError } = await supabase
      .from('usuarios')
      .select('id, nombre, rol, activo')
      .eq('id', data.user.id)
      .single()

    if (perfilError || !perfilData) {
      await supabase.auth.signOut()
      return { error: { message: 'No se encontró un perfil de usuario asociado a esta cuenta.' } }
    }
    if (!perfilData.activo) {
      await supabase.auth.signOut()
      return { error: { message: 'Esta cuenta está desactivada. Contacta al administrador.' } }
    }

    setPerfil(perfilData)
    return { error: null }
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  const value = {
    session,
    usuario: session?.user ?? null,
    perfil,
    rol: perfil?.rol ?? null,
    esSuperAdmin: perfil?.rol === 'super_admin',
    loading,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}