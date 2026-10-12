import type { Lar } from '@/types'
import { Meter } from '@/components/ui/misc'
import { euro, num, pct } from '@/lib/format'
import { QUARTO_CURTO } from '@/lib/labels'
import type { NumerosResumo } from '../lib/derive'
import { MoreLink, Stat } from '../shared/ui'

/** A casa em números — grandes, sem caixas. Um só número principal: a ocupação. */
export function Kpis({ lar, n }: { lar: Lar; n: NumerosResumo }) {
  const livresPorTipo = lar.quartos.filter((q) => q.livres > 0)
  return (
    <section aria-labelledby="numeros-titulo">
      <h2 id="numeros-titulo" className="sr-only">
        A casa em números
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 sm:gap-x-10">
        <Stat hero label="Ocupação" value={`${Math.round(n.ocupacao * 100)}%`} note={`${n.ocupados} de ${n.capacidade} lugares`}>
          <dd className="mt-4">
            <Meter value={n.ocupacao} label={`Taxa de ocupação: ${pct(n.ocupacao)}`} className="h-1 max-w-48" />
          </dd>
        </Stat>
        <Stat
          delay={60}
          label="Lugares livres"
          value={n.livres}
          note={livresPorTipo.length ? livresPorTipo.map((q) => `${q.livres} ${QUARTO_CURTO[q.tipo].toLowerCase()}`).join(' · ') : 'Casa cheia'}
        />
        <Stat
          delay={120}
          label="Pedidos novos"
          value={n.novos}
          note={
            n.novos > 0 ? (
              <MoreLink to="/gestao/pedidos?filtro=novos" className="-my-3">
                Abrir
              </MoreLink>
            ) : (
              'Nenhum por ler'
            )
          }
        />
        <Stat
          delay={180}
          label="Lista de espera"
          value={n.listaTotal}
          note={n.listaTotal > 0 ? `${n.listaOnline} pela plataforma · ${n.listaOffline} por telefone ou presencialmente` : 'Ninguém inscrito'}
        />
        <Stat delay={240} label="Visualizações" value={num(n.visualizacoes)} note="da ficha, nos últimos 30 dias" />
        <Stat
          delay={300}
          label="Receita mensal em risco"
          value={euro(n.receita)}
          note={n.receita > 0 ? `por cada mês com ${n.livres === 1 ? 'o lugar livre vazio' : `os ${n.livres} lugares livres vazios`}` : 'Todos os lugares ocupados'}
        />
      </dl>
    </section>
  )
}
