import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { Candidatura } from '@/types'
import { entradaVerificada } from '@/lib/negocio'
import { entradasEsteAno } from '../lib/derive'
import { useAgora } from '../lib/hooks'

/**
 * Atalho para /gestao/entradas — no telemóvel a barra de abas tem 5 separadores fixos e as Entradas
 * não cabem lá; aqui ficam a um toque. O cartão inteiro é a ligação (alvo grande).
 */
export function EntradasCard({ cands }: { cands: Candidatura[] }) {
  const agora = useAgora()
  const ano = entradasEsteAno(cands, agora)
  const aguardar = ano.filter((c) => !entradaVerificada(c)).length
  const porMarcar = cands.filter((c) => c.estado === 'aceite').length
  const nota = [
    porMarcar ? `${porMarcar === 1 ? '1 vaga aceite' : `${porMarcar} vagas aceites`} por marcar` : null,
    aguardar ? `${aguardar} a aguardar confirmação` : null,
  ].filter(Boolean)
  return (
    <Link
      to="/gestao/entradas"
      className="group flex min-h-16 items-center justify-between gap-4 rounded-[1.5rem] bg-sand px-6 py-5 transition-colors hover:bg-sand-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terra-500"
    >
      <span className="min-w-0">
        <span className="block text-lg font-semibold text-ink">
          Entradas: {ano.length} este ano
        </span>
        <span className="block text-sm text-ink-mute">{nota.length ? nota.join(' · ') : 'Quem entrou através do EncontraLar'}</span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-mute transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  )
}
