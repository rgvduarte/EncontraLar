import { useCallback, useEffect, useState } from 'react'

/** Hora atual, renovada a cada `ms` (para "há 3 min", contagens decrescentes de prazos…). */
export function useAgora(ms = 60_000): number {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return agora
}

/**
 * Pequena preferência por instituição guardada no navegador (ex.: lista de arranque dispensada).
 * Conveniência local — se o armazenamento falhar, o painel continua a funcionar.
 */
export function useLocalFlag(key: string): [boolean, (v: boolean) => void] {
  const full = `encontralar:gestao:${key}`
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(full) === '1'
    } catch {
      return false
    }
  })
  const set = useCallback(
    (v: boolean) => {
      setValue(v)
      try {
        if (v) localStorage.setItem(full, '1')
        else localStorage.removeItem(full)
      } catch {
        /* modo privado — fica só em memória */
      }
    },
    [full],
  )
  return [value, set]
}
