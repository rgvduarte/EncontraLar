import { useEffect, useState } from 'react'

/** Hora atual, renovada periodicamente — mantém os "há 3 min" verdadeiros sem recarregar a página. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
