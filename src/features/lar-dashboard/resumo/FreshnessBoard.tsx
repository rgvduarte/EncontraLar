import { useState } from 'react'
import { ArrowRight, Check, TriangleAlert } from 'lucide-react'
import type { Lar } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { calcadaStonesBg } from '@/components/brand/patterns'
import { confirmarVagasAtualizadas } from '@/lib/store'
import { euro, tempoRelativo } from '@/lib/format'
import { QUARTO_CURTO } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { dataHoraLonga, diasDesde, frescura } from '../lib/derive'
import { useAgora } from '../lib/hooks'

/**
 * "O seu quadro de vagas" — o mesmo painel escuro que as famílias veem na página inicial,
 * com a pergunta que importa: a informação ainda está certa?
 */
export function FreshnessBoard({ lar }: { lar: Lar }) {
  const agora = useAgora(30_000)
  const [confirmado, setConfirmado] = useState(false)
  const f = frescura(lar.atualizadoEm, agora)
  const dias = Math.floor(diasDesde(lar.atualizadoEm, agora))
  const quando = tempoRelativo(lar.atualizadoEm, new Date(agora))

  const confirmar = () => {
    confirmarVagasAtualizadas(lar.id)
    setConfirmado(true)
    toast.success('Vagas confirmadas', 'A sua ficha mostra agora que a informação é de hoje.')
  }

  return (
    <section
      aria-labelledby="quadro-titulo"
      className="on-dark relative overflow-hidden rounded-[1.75rem] bg-pine-950 text-pine-50 shadow-lift ring-1 ring-black/20"
      style={calcadaStonesBg('#ffffff', 0.035)}
    >
      {f === 'desatualizada' && !confirmado && (
        <p className="flex items-start gap-3 bg-sun-400 px-6 py-3.5 font-bold text-pine-950 sm:px-8">
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          <span>
            Há {dias} dias sem confirmar as vagas. Fichas desatualizadas descem nos resultados — e as famílias voltam a telefonar a perguntar.
          </span>
        </p>
      )}

      <div className="px-6 pt-6 sm:px-8 sm:pt-8">
        <p className="flex items-center gap-2.5 text-sm font-bold tracking-[0.16em] text-sun-200 uppercase">
          <span aria-hidden className="relative flex size-2.5">
            {f !== 'desatualizada' && <span className="absolute inline-flex size-full animate-ping rounded-full bg-leaf-200 opacity-70 motion-reduce:hidden" />}
            <span className={cn('relative inline-flex size-2.5 rounded-full', f === 'desatualizada' ? 'bg-sun-400' : 'bg-leaf-200')} />
          </span>
          O seu quadro de vagas
        </p>
        <h2 id="quadro-titulo" className="mt-3 max-w-2xl font-display text-3xl font-semibold text-white sm:text-4xl">
          As suas vagas foram atualizadas <em>{quando}</em>.
        </h2>
        <p className="mt-2 text-pine-200">Última alteração: {dataHoraLonga(lar.atualizadoEm)}.</p>
      </div>

      <ul className="mx-6 mt-6 divide-y divide-white/10 rounded-2xl border border-white/10 bg-black/15 sm:mx-8" aria-label="Lugares livres por tipo de quarto">
        {lar.quartos.map((q) => (
          <li key={q.tipo} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[8rem_1fr_auto] sm:px-5">
            <span className="font-bold text-white">{QUARTO_CURTO[q.tipo]}</span>
            <span className="order-3 col-span-2 text-sm text-pine-300 sm:order-none sm:col-span-1">
              {q.total} {q.total === 1 ? 'lugar' : 'lugares'} · desde {euro(q.precoMin)}/mês
            </span>
            <span
              className={cn(
                'justify-self-end rounded-lg px-2.5 py-1 font-mono text-base font-bold tabular-nums',
                q.livres > 0 ? 'bg-sun-400 text-pine-950' : 'bg-white/8 text-pine-200',
              )}
            >
              {q.livres > 0 ? `${q.livres} ${q.livres === 1 ? 'livre' : 'livres'}` : 'completo'}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-4 px-6 pt-6 pb-7 sm:px-8 sm:pb-8 md:flex-row md:items-center">
        {confirmado ? (
          <p role="status" className="inline-flex min-h-14 animate-fade-up items-center gap-3 rounded-2xl border-2 border-leaf-200/60 bg-leaf-500/15 px-6 text-lg font-bold text-leaf-100">
            <Check aria-hidden className="size-6" strokeWidth={3} />
            Confirmado agora mesmo — obrigado
          </p>
        ) : (
          <Button
            size="lg"
            variant={f === 'fresca' ? 'secondary' : 'accent'}
            icon={<Check aria-hidden className="size-6" strokeWidth={3} />}
            onClick={confirmar}
            className={cn('w-full whitespace-normal md:w-auto', f === 'fresca' && 'border-white bg-white text-pine-900 hover:text-pine-950')}
          >
            Está tudo certo — confirmar
          </Button>
        )}
        <ButtonLink
          to="/gestao/vagas"
          size="lg"
          variant="ghost"
          iconRight={<ArrowRight aria-hidden className="size-5" />}
          className="w-full whitespace-normal text-white hover:bg-white/10 active:bg-white/15 md:w-auto"
        >
          Mudou alguma coisa? Alterar vagas
        </ButtonLink>
      </div>
      <p className="border-t border-white/10 px-6 py-4 text-sm text-pine-300 sm:px-8">
        Confirmar não altera os números: apenas diz às famílias que a informação foi verificada hoje.
      </p>
    </section>
  )
}
