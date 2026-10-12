/**
 * "Do telefone ao painel" — lista editorial numerada (problema → solução), cada linha com uma
 * pré-visualização real do produto ao lado.
 */
import { useMemo, type ReactNode } from 'react'
import { MapPin } from 'lucide-react'
import type { Lar } from '@/types'
import { useCandidaturasDoLar } from '@/lib/store'
import { euro, tempoRelativo } from '@/lib/format'
import { QUARTO_CURTO } from '@/lib/labels'
import { AvailabilityBadge, VerifiedBadge } from '@/components/lar/badges'
import { LarCover } from '@/components/lar/LarCover'
import { Stars } from '@/components/ui/Stars'
import { Badge } from '@/components/ui/Badge'
import { PedidoPreview, SaidasPreview } from './SidePreviews'

function MiniFicha({ lar }: { lar: Lar }) {
  return (
    <div className="flex items-center gap-4 rounded-3xl border border-line bg-white p-3 pr-5 shadow-card">
      <div className="h-20 w-24 shrink-0 overflow-hidden rounded-2xl">
        <LarCover hue={lar.capa.hue} variante={lar.capa.variante} />
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <AvailabilityBadge lar={lar} />
        <p className="self-stretch truncate font-bold text-ink">{lar.nome}</p>
        <p className="flex items-center gap-1 self-stretch text-sm text-ink-mute">
          <MapPin aria-hidden className="size-4 shrink-0" /> {lar.localidade} · atualizado {tempoRelativo(lar.atualizadoEm)}
        </p>
      </div>
    </div>
  )
}

function MiniLista({ lar }: { lar: Lar }) {
  const cands = useCandidaturasDoLar(lar.id)
  const lista = useMemo(
    () => cands.filter((c) => c.estado === 'lista_espera' && c.posicao != null).sort((a, b) => a.posicao! - b.posicao!).slice(0, 4),
    [cands],
  )
  if (!lista.length) return null
  return (
    <div className="rounded-3xl border border-line bg-white p-5 shadow-card">
      <p className="text-xs font-bold tracking-[0.12em] text-pine-700 uppercase">Lista de espera</p>
      <ol className="mt-3 flex flex-col divide-y divide-line">
        {lista.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-2.5">
            <span className="font-display flex size-9 shrink-0 items-center justify-center rounded-full bg-pine-50 font-semibold text-pine-800 tabular">
              {c.posicao}
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">
              {c.perfil.nome.split(' ')[0]} {c.perfil.nome.split(' ').slice(-1)[0]![0]}.
              <span className="font-normal text-ink-mute">, {c.perfil.idade} anos</span>
            </span>
            <span className="text-sm text-ink-soft">{c.perfil.quarto === 'indiferente' ? 'Qualquer quarto' : QUARTO_CURTO[c.perfil.quarto]}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function MiniReputacao({ lar }: { lar: Lar }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-3xl border border-line bg-white p-5 shadow-card">
      <div className="flex flex-col">
        <span className="font-display text-4xl font-semibold text-ink tabular">{lar.avaliacao.toLocaleString('pt-PT')}</span>
        <Stars value={lar.avaliacao} />
      </div>
      <div className="flex flex-col items-start gap-1.5 text-sm text-ink-soft">
        <VerifiedBadge lar={lar} />
        <span>{lar.numAvaliacoes} avaliações de familiares</span>
        <span>
          Mensalidade desde <strong className="text-ink tabular">{euro(lar.mensalidadeMin)}</strong>, preços publicados
        </span>
      </div>
    </div>
  )
}

interface Linha {
  hoje: string
  agora: ReactNode
  plano: 'Essencial' | 'Profissional'
  aside: ReactNode
}

export function ProblemsSection({ lar }: { lar: Lar }) {
  const linhas: Linha[] = [
    {
      hoje: '«Bom dia, ainda têm vaga?» — outra vez, e outra.',
      agora: (
        <>
          As vagas ficam no mapa, <strong>atualizadas por si num toque</strong>. Quem lhe telefona já sabe que há lugar — e liga para marcar a
          visita.
        </>
      ),
      plano: 'Essencial',
      aside: <MiniFicha lar={lar} />,
    },
    {
      hoje: '«É para a minha mãe, tem 84 anos.» E mais nada.',
      agora: (
        <>
          Cada pedido chega com o <strong>perfil clínico</strong>: grau de dependência, cuidados necessários, urgência e orçamento — e a
          compatibilidade com a sua casa já verificada.
        </>
      ),
      plano: 'Essencial',
      aside: <PedidoPreview lar={lar} />,
    },
    {
      hoje: 'A lista de espera vive num caderno — e já ninguém sabe quem ainda espera.',
      agora: (
        <>
          <strong>Lista de espera digital</strong>, com a posição e o estado de cada família. Quando abre uma vaga, propõe-na com prazo de
          resposta de 48 horas e passa à seguinte se for recusada.
        </>
      ),
      plano: 'Profissional',
      aside: <MiniLista lar={lar} />,
    },
    {
      hoje: 'Um quarto vazio durante semanas, à espera de que alguém ligue.',
      agora: (
        <>
          A <strong>previsão de saídas</strong> mostra quantos lugares deverão libertar-se em cada mês, para preparar entradas com antecedência.
          Ao publicar a vaga, quem segue a sua casa é avisado no momento.
        </>
      ),
      plano: 'Profissional',
      aside: <SaidasPreview lar={lar} />,
    },
    {
      hoje: 'A reputação depende do boca a boca — e de quem conhece quem.',
      agora: (
        <>
          Uma <strong>ficha completa e verificada</strong>, com preços, cuidados e avaliações de familiares, ao lado das outras instituições da
          sua zona. As boas casas deixam de ser segredo.
        </>
      ),
      plano: 'Essencial',
      aside: <MiniReputacao lar={lar} />,
    },
  ]

  return (
    <section aria-labelledby="pl-problemas" className="container-page py-20 sm:py-28">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="eyebrow">Do telefone ao painel</p>
          <h2 id="pl-problemas" className="mt-3 text-4xl font-semibold text-ink sm:text-5xl">
            Menos tempo ao telefone, <em>mais tempo</em> com os residentes.
          </h2>
        </div>
        <p className="self-end text-lg text-ink-soft lg:col-span-5">
          Cinco situações que qualquer direção técnica conhece — e o que muda quando as vagas, os pedidos e a lista de espera estão no mesmo
          sítio. Os exemplos vêm do painel da {lar.nome}, a instituição fictícia de demonstração.
        </p>
      </div>

      <ol className="mt-14 flex flex-col">
        {linhas.map((l, i) => (
          <li key={l.hoje} className="grid gap-8 border-t border-line-strong py-10 lg:grid-cols-12 lg:gap-12 lg:py-12">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:gap-8 lg:col-span-7">
              <span aria-hidden className="font-display shrink-0 text-5xl leading-none font-semibold text-terra-500 tabular sm:w-20 sm:text-6xl">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="flex min-w-0 flex-col gap-4">
                <div>
                  <p className="text-xs font-bold tracking-[0.12em] text-ink-mute uppercase">Hoje</p>
                  <p className="font-display mt-1 text-2xl leading-snug text-ink-soft italic sm:text-3xl">{l.hoje}</p>
                </div>
                <div>
                  <p className="text-xs font-bold tracking-[0.12em] text-pine-700 uppercase">Com o EncontraLar</p>
                  <p className="mt-1 max-w-[52ch] text-lg text-ink-soft [&_strong]:text-ink">{l.agora}</p>
                </div>
                <Badge tone={l.plano === 'Essencial' ? 'leaf' : 'terra'} className="self-start">
                  Plano {l.plano}
                  {l.plano === 'Essencial' ? ' · gratuito' : ''}
                </Badge>
              </div>
            </div>
            <div className="min-w-0 sm:pl-28 lg:col-span-5 lg:pl-0 lg:pt-2">{l.aside}</div>
          </li>
        ))}
      </ol>
    </section>
  )
}
