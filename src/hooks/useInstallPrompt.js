import { useEffect, useState } from 'react'

export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null)
  const [instalable, setInstalable] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setPromptEvent(e)
      setInstalable(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const instalar = async () => {
    if (!promptEvent) return
    promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted') setInstalable(false)
    setPromptEvent(null)
  }

  return { instalable, instalar }
}