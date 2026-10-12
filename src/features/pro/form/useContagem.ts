import { useMemo } from 'react'
import type { Lar } from '@/types'
import { recomendar } from '@/lib/matching'
import { useDebounced } from '@/lib/hooks'
import { perfilDoForm, type CasoForm } from './casoModel'

/** Quantas instituições servem este perfil dentro do raio, e quantas têm vaga para quem pede hoje (feedback ao editar). */
export function useContagem(form: CasoForm, lares: Lar[]): { compativeis: number; comVaga: number } | null {
  const f = useDebounced(form, 300)
  return useMemo(() => {
    if (!f.local) return null
    const perfil = perfilDoForm({ ...f, nome: f.nome || '—', idade: Number.isFinite(f.idade) ? f.idade : 80 })
    const dentro = recomendar(lares, perfil, 1000).filter((m) => m.compativel && m.distanciaKm <= perfil.raioKm)
    return { compativeis: dentro.length, comVaga: dentro.filter((m) => m.espera.imediata).length }
  }, [lares, f])
}
