import { Check, CircleX, X } from 'lucide-react'
import type { Lar } from '@/types'
import { CUIDADO_ICON } from '@/components/lar/icons'
import { CUIDADOS_CRITICOS, CUIDADOS_ORDEM, CUIDADO_LABEL, GRAUS_ORDEM, GRAU_DESCRICAO, GRAU_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { Secao, Subtitulo } from '../Secao'
import { EquipaRacio } from './EquipaRacio'

export function CuidadosSection({ lar, numero }: { lar: Lar; numero: number }) {
  const oferecidos = CUIDADOS_ORDEM.filter((c) => lar.cuidados.includes(c))
  const criticosEmFalta = CUIDADOS_CRITICOS.filter((c) => !lar.cuidados.includes(c))

  return (
    <Secao
      id="ficha-cuidados"
      numero={numero}
      rotulo="Cuidados e equipa"
      titulo={
        <>
          Quem <em>cuida</em>, e de quê
        </>
      }
      intro="O que a instituição assegura no dia a dia, para que graus de dependência, e com que equipa."
    >
      <Subtitulo>Cuidados assegurados</Subtitulo>
      {oferecidos.length ? (
        <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
          {oferecidos.map((c) => {
            const Icon = CUIDADO_ICON[c]
            return (
              <li key={c} className="flex min-h-14 items-center gap-3.5 border-b border-line py-2.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pine-50 text-pine-700">
                  <Icon aria-hidden className="size-5" strokeWidth={1.9} />
                </span>
                <span className="flex-1 font-semibold text-ink">{CUIDADO_LABEL[c]}</span>
                <Check aria-hidden className="size-5 shrink-0 text-leaf-600" strokeWidth={2.6} />
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-3 text-ink-soft">A instituição ainda não indicou os cuidados de saúde que assegura.</p>
      )}

      {criticosEmFalta.length > 0 && (
        <div className="mt-6 rounded-2xl border border-line bg-sand/70 p-5">
          <p className="font-bold text-ink">Não disponível nesta instituição</p>
          <p className="mt-1 text-sm text-ink-soft">
            Cuidados essenciais para alguns perfis. Se a pessoa precisar de algum deles, procure outra resposta ou confirme diretamente.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {criticosEmFalta.map((c) => (
              <li key={c} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line-strong bg-white px-3 text-sm font-semibold text-ink-soft">
                <CircleX aria-hidden className="size-4.5 text-alert-600" />
                {CUIDADO_LABEL[c]}
                <span className="sr-only">: não disponível</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Subtitulo className="mt-12">Graus de dependência aceites</Subtitulo>
      <ol className="mt-4 grid gap-3 sm:grid-cols-4 sm:gap-0">
        {GRAUS_ORDEM.map((g, i) => {
          const aceita = lar.graus.includes(g)
          return (
            <li key={g} className={cn('flex gap-4 sm:flex-col sm:gap-3 sm:pr-4', i > 0 && 'sm:pl-4', i < 3 && 'sm:border-r sm:border-line')}>
              <span
                aria-hidden
                className={cn(
                  'mt-1 w-2 shrink-0 rounded-full sm:mt-0 sm:h-2.5 sm:w-full',
                  aceita ? 'bg-pine-600' : 'bg-[repeating-linear-gradient(135deg,var(--color-line-strong)_0_4px,transparent_4px_8px)]',
                )}
              />
              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold">
                  {aceita ? <Check aria-hidden className="size-4 text-leaf-600" strokeWidth={3} /> : <X aria-hidden className="size-4 text-ink-mute" strokeWidth={3} />}
                  <span className={aceita ? 'text-leaf-700' : 'text-ink-mute'}>{aceita ? 'Aceita' : 'Não aceita'}</span>
                </p>
                <p className={cn('mt-1 font-display text-lg leading-snug font-semibold', aceita ? 'text-ink' : 'text-ink-mute')}>{GRAU_LABEL[g]}</p>
                <p className={cn('mt-1 text-sm', aceita ? 'text-ink-soft' : 'text-ink-mute')}>{GRAU_DESCRICAO[g]}</p>
              </div>
            </li>
          )
        })}
      </ol>

      <Subtitulo className="mt-12">A equipa</Subtitulo>
      <EquipaRacio lar={lar} />
    </Secao>
  )
}
