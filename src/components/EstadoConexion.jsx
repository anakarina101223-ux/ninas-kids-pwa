import { useEffect, useState } from 'react'

export default function EstadoConexion() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (online) return null

  return (
    <div className="nk-offline-banner">
      Sin conexión a internet — algunas funciones no estarán disponibles hasta que vuelva la señal.
    </div>
  )
}