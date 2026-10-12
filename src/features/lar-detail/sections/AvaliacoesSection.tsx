import { useState } from 'react'
import { Link } from 'react-router'
import { BadgeCheck, MessageSquareText } from 'lucide-react'
import type { Lar, Review } from '@/types'
import { Stars } from '@/components/ui/Stars'
import { Button } from '@/components/ui/Button'
import { plural } from '@/lib/format'
import { Secao } from '../Secao'

const ASPETOS: { k: keyof Review['aspetos']; label: string }[] = [
  { k: 'cuidados', label: 'Cuidados' },
  { k: 'alimentacao', label: 'Alimentação' },
  { k: 'instalacoes', label: 'Instalações' },
  { k: 'comunicacao', label: 'Comunicação com a família' },
]

const mesExtenso = (iso: string) => new Date(iso).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })

const dec1 = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function Opiniao({ r }: { r: Review }) {
  return (
    <li className="grid gap-3 py-6 sm:grid-cols-[11rem_1fr] sm:gap-6">
      <div className="flex flex-row flex-wrap items-center gap-x-3 gap-y-1 sm:flex-col sm:items-start">
        <p className="font-bold text-ink">{r.autor}</p>
        <p className="text-sm text-ink-soft">{r.relacao}</p>
        <p className="text-sm text-ink-mute">{mesExtenso(r.data)}</p>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <Stars value={r.nota} />
          {r.verificada && (
            <span className="inline-flex items-center gap-1 text-sm font-bold text-pine-700">
              <BadgeCheck aria-hidden className="size-4" /> Verificada
            </span>
          )}
        </div>
        <blockquote className="relative mt-2 text-lg leading-relaxed text-ink">
          <span aria-hidden className="absolute -top-3 -left-1 font-display text-5xl leading-none text-terra-200 select-none sm:-left-6">
            “
          </span>
          <p className="relative">{r.texto}</p>
        </blockquote>
      </div>
    </li>
  )
}

export function AvaliacoesSection({ lar, numero }: { lar: Lar; numero: number }) {
  const [todas, setTodas] = useState(false)
  const reviews = lar.reviews
  const mostradas = todas ? reviews : reviews.slice(0, 3)
  const medias = ASPETOS.map((a) => ({
    ...a,
    v: reviews.length ? reviews.reduce((s, r) => s + r.aspetos[a.k], 0) / reviews.length : 0,
  }))

  return (
    <Secao
      id="ficha-avaliacoes"
      numero={numero}
      rotulo="Avaliações"
      titulo={
        <>
          O que dizem as <em>famílias</em>
        </>
      }
    >
      {lar.numAvaliacoes === 0 && reviews.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-3xl border-2 border-dashed border-line-strong bg-white/60 p-6 sm:p-8">
          <MessageSquareText aria-hidden className="size-8 text-pine-700" />
          <p className="font-display text-2xl font-semibold">Ainda sem avaliações</p>
          <p className="max-w-xl text-ink-soft">
            Só famílias com um pedido ou um familiar nesta instituição podem avaliá-la. Até lá, a melhor forma de a conhecer é marcar uma visita — leve
            a{' '}
            <Link to="/guia#visita" className="link">
              lista de perguntas do nosso guia
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-8 rounded-3xl border border-line bg-white p-6 sm:grid-cols-[auto_1fr] sm:gap-12 sm:p-8">
            <div>
              <p className="font-display text-7xl leading-none font-semibold text-ink tabular">{dec1(lar.avaliacao)}</p>
              <Stars value={lar.avaliacao} size="lg" className="mt-3" />
              <p className="mt-2 text-sm text-ink-soft">{plural(lar.numAvaliacoes, 'avaliação', 'avaliações')}</p>
            </div>
            {reviews.length > 0 && (
              <dl className="flex flex-col justify-center gap-4">
                {medias.map((a) => (
                  <div key={a.k} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[13rem_1fr_auto]">
                    <dt className="text-ink">{a.label}</dt>
                    <dd className="order-last col-span-2 sm:order-none sm:col-span-1">
                      <div className="h-2.5 overflow-hidden rounded-full bg-sand-deep" aria-hidden>
                        <div className="h-full rounded-full bg-sun-500" style={{ width: `${(a.v / 5) * 100}%` }} />
                      </div>
                    </dd>
                    <dd className="text-right font-bold tabular">
                      {dec1(a.v)}
                      <span className="sr-only"> em 5</span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {reviews.length > 0 && (
            <>
              <p className="mt-6 text-sm text-ink-mute">
                A mostrar {mostradas.length} de {plural(reviews.length, 'opinião publicada', 'opiniões publicadas')}, das mais recentes para as mais antigas.
                As médias por aspeto são calculadas sobre as opiniões publicadas. Dados de demonstração: autores e textos fictícios.
              </p>
              <ul className="mt-2 divide-y divide-line border-b border-line">
                {mostradas.map((r) => (
                  <Opiniao key={r.id} r={r} />
                ))}
              </ul>
              {reviews.length > 3 && (
                <Button variant="secondary" className="mt-6" onClick={() => setTodas((v) => !v)} aria-expanded={todas}>
                  {todas ? 'Mostrar menos' : `Ver as ${reviews.length} opiniões`}
                </Button>
              )}
            </>
          )}
        </>
      )}
    </Secao>
  )
}
