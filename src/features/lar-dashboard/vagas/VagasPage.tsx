import type { Lar } from '@/types'
import { AvailabilityBadge } from '@/components/lar/badges'
import { useDB } from '@/lib/store'
import { vagasLivres } from '@/lib/forecast'
import { plural, tempoRelativo } from '@/lib/format'
import { dataHoraLonga, destinatariosAviso } from '../lib/derive'
import { useAgora } from '../lib/hooks'
import { MoreLink } from '../shared/ui'
import { AddRoomType } from './AddRoomType'
import { RoomRow } from './RoomRow'

/** Uma frase sobre os avisos automáticos, com quem seria avisado agora. */
function avisoTexto(lista: number, seguidores: number): string {
  const quem = [
    lista ? `${plural(lista, 'família', 'famílias')} da lista de espera` : null,
    seguidores ? `${seguidores === 1 ? 'a família que segue' : `as ${seguidores} que seguem`} a sua ficha` : null,
  ].filter(Boolean)
  const base = 'Quando aumenta os lugares livres, o lugar aparece logo no mapa de vagas'
  return quem.length ? `${base} e avisamos ${quem.join(' e ')}. Quando diminui, ninguém é incomodado.` : `${base}. Quando diminui, ninguém é incomodado.`
}

/** /gestao/vagas — um tipo de quarto por linha, com contador grande e gravação automática. */
export default function VagasPage({ lar }: { lar: Lar }) {
  const agora = useAgora(30_000)
  const livres = vagasLivres(lar)
  const d = destinatariosAviso(useDB(), lar)

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="vagas-total">
        <p id="vagas-total" className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-6xl leading-none font-semibold tracking-tight">{livres}</span>
          <span className="text-2xl font-semibold text-ink-mute">
            {livres === 1 ? 'lugar livre' : 'lugares livres'} de {lar.capacidade}
          </span>
        </p>
        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-mute">
          No mapa de vagas: <AvailabilityBadge lar={lar} />
          <MoreLink to={`/lar/${lar.id}`}>Ver como as famílias veem</MoreLink>
        </p>
        <p className="mt-3 max-w-2xl text-ink-mute">{avisoTexto(d.lista, d.seguidores)}</p>
      </section>

      <section aria-label="Lugares livres por tipo de quarto">
        {lar.quartos.length === 0 ? (
          <p className="pb-6 text-ink-mute">Ainda não indicou nenhum tipo de quarto. Adicione pelo menos um para as famílias saberem o que oferece.</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {lar.quartos.map((q) => (
              <RoomRow key={q.tipo} larId={lar.id} quarto={q} podeRemover={lar.quartos.length > 1} />
            ))}
          </ul>
        )}
        <AddRoomType lar={lar} />
      </section>

      <p className="text-sm text-ink-mute">
        Última atualização: {dataHoraLonga(lar.atualizadoEm)} ({tempoRelativo(lar.atualizadoEm, new Date(agora))}). As alterações gravam-se sozinhas, um segundo
        depois do último toque.
      </p>
    </div>
  )
}
