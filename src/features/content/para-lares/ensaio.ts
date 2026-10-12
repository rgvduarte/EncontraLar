/**
 * Modo de ensaio do painel na página /para-lares: os botões mexem nas vagas de uma cópia local
 * da instituição de demonstração. Nada é gravado no store.
 */
import { useCallback, useMemo, useState } from 'react'
import type { DB, Lar, TipoQuarto } from '@/types'

export interface EventoEnsaio {
  tipo: TipoQuarto
  acao: 'abriu' | 'ocupou'
  quando: string
  key: number
}

export interface Ensaio {
  /** a instituição com as vagas do ensaio (para badges e previsão) */
  lar: Lar
  livres: Record<string, number>
  tocou: boolean
  evento: EventoEnsaio | null
  mudar: (tipo: TipoQuarto, delta: number) => void
}

export function useEnsaio(base: Lar): Ensaio {
  const [livres, setLivres] = useState<Record<string, number>>(() => Object.fromEntries(base.quartos.map((q) => [q.tipo, q.livres])))
  const [tocou, setTocou] = useState(false)
  const [evento, setEvento] = useState<EventoEnsaio | null>(() => {
    const q = base.quartos.find((x) => x.livres > 0)
    return q ? { tipo: q.tipo, acao: 'abriu', quando: base.atualizadoEm, key: 0 } : null
  })

  const mudar = useCallback(
    (tipo: TipoQuarto, delta: number) => {
      const q = base.quartos.find((x) => x.tipo === tipo)
      if (!q) return
      const atual = livres[tipo] ?? 0
      const novo = Math.max(0, Math.min(q.total, atual + delta))
      if (novo === atual) return
      setLivres({ ...livres, [tipo]: novo })
      setTocou(true)
      setEvento({ tipo, acao: delta > 0 ? 'abriu' : 'ocupou', quando: new Date().toISOString(), key: Date.now() })
    },
    [base, livres],
  )

  const lar = useMemo<Lar>(
    () => ({
      ...base,
      quartos: base.quartos.map((q) => ({ ...q, livres: livres[q.tipo] ?? q.livres })),
      atualizadoEm: tocou && evento ? evento.quando : base.atualizadoEm,
    }),
    [base, livres, tocou, evento],
  )

  return { lar, livres, tocou, evento, mudar }
}

/** Famílias que seriam avisadas se abrisse uma vaga agora (mesma regra do store: lista de espera + alertas). */
export function familiasAAvisar(db: DB, lar: Lar): number {
  const ids = new Set<string>()
  for (const c of db.candidaturas) if (c.larId === lar.id && c.estado === 'lista_espera') ids.add(c.userId)
  for (const f of db.favoritos) if (f.larId === lar.id && f.alerta && f.userId !== lar.ownerId) ids.add(f.userId)
  return ids.size
}

/** "Joaquim Sousa" → "Joaquim S." (basta a inicial numa página pública). */
export const nomeCurto = (nome: string) => {
  const p = nome.trim().split(/\s+/)
  return p.length > 1 ? `${p[0]} ${p[p.length - 1]![0]}.` : nome
}
