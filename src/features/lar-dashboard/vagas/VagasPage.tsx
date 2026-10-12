import { Link } from 'react-router'
import { ArrowUpRight, History } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { AvailabilityBadge } from '@/components/lar/badges'
import { calcadaStonesBg } from '@/components/brand/patterns'
import { useDB } from '@/lib/store'
import { vagasLivres } from '@/lib/forecast'
import { tempoRelativo } from '@/lib/format'
import { dataHoraLonga, destinatariosAviso } from '../lib/derive'
import { useAgora } from '../lib/hooks'
import { AddRoomType } from './AddRoomType'
import { RoomCard } from './RoomCard'

function QuemEAvisado({ lar }: { lar: Lar }) {
  const db = useDB()
  const d = destinatariosAviso(db, lar)
  const passos = [
    {
      titulo: 'A sua lista de espera',
      texto: `As famílias que inscreveu pela plataforma — ${d.lista === 1 ? '1 neste momento' : `${d.lista} neste momento`}. Recebem o aviso com a posição em que estão.`,
    },
    {
      titulo: 'Quem segue a sua ficha',
      texto: `Famílias que guardaram a instituição com alerta de vaga — ${d.seguidores === 1 ? '1 neste momento' : `${d.seguidores} neste momento`}.`,
    },
    {
      titulo: 'Quem procura agora',
      texto: 'O lugar aparece de imediato como livre no mapa de vagas e sobe nos resultados.',
    },
  ]
  return (
    <section
      aria-labelledby="avisados-titulo"
      className="on-dark relative overflow-hidden rounded-3xl bg-pine-900 p-6 text-pine-50 shadow-card sm:p-8"
      style={calcadaStonesBg('#ffffff', 0.04)}
    >
      <p className="text-xs font-bold tracking-[0.12em] text-sun-200 uppercase">Avisos automáticos</p>
      <h2 id="avisados-titulo" className="mt-2 max-w-xl font-display text-2xl font-semibold text-white sm:text-3xl">
        Quando aumenta as vagas, <em>avisamos por si</em>.
      </h2>
      <ol className="mt-6 grid gap-6 md:grid-cols-3">
        {passos.map((p, i) => (
          <li key={p.titulo} className="grid grid-cols-[2.25rem_1fr] gap-3">
            <span aria-hidden className="font-display text-4xl leading-none font-semibold text-terra-300">
              {i + 1}
            </span>
            <div>
              <h3 className="font-sans text-base font-bold text-white">{p.titulo}</h3>
              <p className="mt-0.5 text-sm text-pine-200">{p.texto}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-6 border-t border-white/15 pt-4 text-pine-200">Quando diminui as vagas, ninguém é incomodado. E não precisa de telefonar a ninguém.</p>
    </section>
  )
}

/** /gestao/vagas — um cartão por tipo de quarto, com contador grande e gravação imediata. */
export default function VagasPage({ lar }: { lar: Lar; cands: Candidatura[] }) {
  const agora = useAgora(30_000)
  const livres = vagasLivres(lar)
  const avisaveis = destinatariosAviso(useDB(), lar).total
  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Estado atual" className="flex flex-col gap-4 rounded-3xl border border-line bg-white p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="font-display text-4xl leading-none font-semibold tabular">
            {livres}
            <span className="ml-2 font-sans text-lg font-semibold text-ink-soft">
              {livres === 1 ? 'lugar livre' : 'lugares livres'} de {lar.capacidade}
            </span>
          </p>
          <span className="flex items-center gap-2 text-sm text-ink-soft">
            No mapa de vagas: <AvailabilityBadge lar={lar} />
          </span>
        </div>
        <Link to={`/lar/${lar.id}`} className="link inline-flex min-h-11 items-center gap-1 text-sm">
          Ver como as famílias veem <ArrowUpRight aria-hidden className="size-4" />
        </Link>
      </section>

      <div className="flex flex-col gap-6">
        {lar.quartos.length === 0 ? (
          <p className="rounded-3xl border-2 border-dashed border-line-strong bg-white/60 p-6 text-ink-soft">
            Ainda não indicou nenhum tipo de quarto. Adicione pelo menos um para as famílias saberem o que oferece e quanto custa.
          </p>
        ) : (
          lar.quartos.map((q) => <RoomCard key={q.tipo} larId={lar.id} quarto={q} podeRemover={lar.quartos.length > 1} avisaveis={avisaveis} />)
        )}
        <p className="flex items-start gap-2 text-sm text-ink-soft">
          <History aria-hidden className="mt-0.5 size-4.5 shrink-0 text-pine-700" />
          <span>
            Última atualização: <strong className="text-ink">{dataHoraLonga(lar.atualizadoEm)}</strong> ({tempoRelativo(lar.atualizadoEm, new Date(agora))}). As
            alterações gravam-se sozinhas, cerca de um segundo depois do último toque.
          </span>
        </p>
      </div>
      <AddRoomType lar={lar} />
      <QuemEAvisado lar={lar} />
    </div>
  )
}
