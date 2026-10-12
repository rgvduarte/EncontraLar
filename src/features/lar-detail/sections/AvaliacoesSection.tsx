import { useState } from 'react'
import { Link } from 'react-router'
import { BadgeCheck, ChevronRight } from 'lucide-react'
import type { Lar, Review } from '@/types'
import { Stars } from '@/components/ui/Stars'
import { Button } from '@/components/ui/Button'
import { plural } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Bloco, Secao } from '../Secao'
import { Cascata, Contador } from '../motion'

const ASPETOS: { k: keyof Review['aspetos']; label: string }[] = [
  { k: 'cuidados', label: 'Cuidados' },
  { k: 'alimentacao', label: 'Alimentação' },
  { k: 'instalacoes', label: 'Instalações' },
  { k: 'comunicacao', label: 'Comunicação' },
]

const mesExtenso = (iso: string) => new Date(iso).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
const dec1 = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function Opiniao({ r, nova }: { r: Review; nova?: boolean }) {
  return (
    <li className={cn('border-b border-line py-7', nova && 'ficha-troca')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={r.nota} />
        {r.verificada && (
          <span className="inline-flex items-center gap-1 text-sm text-terra-700">
            <BadgeCheck aria-hidden className="size-4" /> Verificada
          </span>
        )}
      </div>
      <blockquote className="mt-3 max-w-[65ch] text-lg leading-relaxed text-ink">
        <p>{r.texto}</p>
      </blockquote>
      <p className="mt-3 text-sm text-ink-mute">
        <span className="font-medium text-ink-soft">{r.autor}</span> · {r.relacao} · {mesExtenso(r.data)}
      </p>
    </li>
  )
}

export function AvaliacoesSection({ lar }: { lar: Lar }) {
  const [todas, setTodas] = useState(false)
  const reviews = lar.reviews
  const mostradas = todas ? reviews : reviews.slice(0, 3)
  const medias = ASPETOS.map((a) => ({
    ...a,
    v: reviews.length ? reviews.reduce((s, r) => s + r.aspetos[a.k], 0) / reviews.length : 0,
  }))

  if (lar.numAvaliacoes === 0 && reviews.length === 0) {
    return (
      <Secao id="ficha-avaliacoes" rotulo="Avaliações" titulo="Ainda sem avaliações">
        <Bloco>
          <p className="max-w-[65ch] text-lg text-ink-mute">
            Só famílias com um pedido ou um familiar nesta instituição a podem avaliar. Até lá, a melhor forma de a conhecer é uma visita.
          </p>
          <Link to="/guia#visita" className="mt-3 inline-flex min-h-12 items-center gap-0.5 text-lg text-terra-600 hover:underline">
            O que perguntar na visita
            <ChevronRight aria-hidden className="size-5" />
          </Link>
        </Bloco>
      </Secao>
    )
  }

  return (
    <Secao id="ficha-avaliacoes" rotulo="Avaliações" titulo="O que dizem as famílias">
      <div className="grid gap-10 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-16">
        <Bloco>
          <p className="text-7xl leading-none font-semibold tracking-tight text-ink tabular">
            <Contador valor={lar.avaliacao} casas={1} />
          </p>
          <Stars value={lar.avaliacao} size="md" className="mt-4" />
          <p className="mt-2 text-sm text-ink-mute">{plural(lar.numAvaliacoes, 'avaliação', 'avaliações')}</p>
        </Bloco>
        {reviews.length > 0 && (
          <div>
            {/* médias por aspeto: as barras enchem em cascata quando entram no ecrã */}
            <Cascata as="dl" passo={90} className="flex flex-col gap-4">
              {medias.map((a) => (
                <div key={a.k} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-4">
                  <dt className="text-ink-soft">{a.label}</dt>
                  <dd aria-hidden className="h-1 overflow-hidden rounded-full bg-sand-deep">
                    <div className="ficha-encher h-full rounded-full bg-ink" style={{ width: `${(a.v / 5) * 100}%` }} />
                  </dd>
                  <dd className="text-right font-medium text-ink tabular">
                    {dec1(a.v)}
                    <span className="sr-only"> em 5</span>
                  </dd>
                </div>
              ))}
            </Cascata>
            <p className="mt-4 text-sm text-ink-mute">Por aspeto, nas {plural(reviews.length, 'opinião publicada', 'opiniões publicadas')}.</p>
          </div>
        )}
      </div>

      {reviews.length > 0 && (
        <>
          <Cascata passo={110} className="mt-12 border-t border-line">
            {mostradas.map((r, i) => (
              <Opiniao key={r.id} r={r} nova={i >= 3} />
            ))}
          </Cascata>
          {reviews.length > 3 && (
            <Button variant="subtle" className="mt-8 max-sm:w-full" onClick={() => setTodas((v) => !v)} aria-expanded={todas}>
              {todas ? 'Mostrar menos' : `Ver as ${reviews.length} opiniões`}
            </Button>
          )}
        </>
      )}
    </Secao>
  )
}
