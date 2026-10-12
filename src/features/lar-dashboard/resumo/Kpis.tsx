import type { Lar } from '@/types'
import { euro, num, pct } from '@/lib/format'
import { QUARTO_CURTO } from '@/lib/labels'
import type { NumerosResumo } from '../lib/derive'
import { Barra, Numero } from '../shared/motion'
import { MoreLink, Stat } from '../shared/ui'

/**
 * A casa em números — grandes, sem caixas. Um só número principal: a ocupação.
 * Os números contam ao aparecer (e voltam a contar, do valor antigo para o novo, quando mudam);
 * a barra de ocupação enche. Entram em cascata, 70ms entre cada.
 */
export function Kpis({ lar, n }: { lar: Lar; n: NumerosResumo }) {
  const livresPorTipo = lar.quartos.filter((q) => q.livres > 0)
  return (
    <section aria-labelledby="numeros-titulo">
      <h2 id="numeros-titulo" className="sr-only">
        A casa em números
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 sm:gap-x-10 sm:gap-y-12">
        <Stat
          hero
          label="Ocupação"
          value={<Numero value={Math.round(n.ocupacao * 100)} format={(v) => `${Math.round(v)}%`} />}
          note={`${n.ocupados} de ${n.capacidade} lugares`}
        >
          <dd className="mt-4">
            <Barra value={n.ocupacao} label={`Taxa de ocupação: ${pct(n.ocupacao)}`} className="max-w-48" />
          </dd>
        </Stat>
        <Stat
          delay={70}
          label="Lugares livres"
          value={<Numero value={n.livres} duration={900} />}
          note={livresPorTipo.length ? livresPorTipo.map((q) => `${q.livres} ${QUARTO_CURTO[q.tipo].toLowerCase()}`).join(' · ') : 'Casa cheia'}
        />
        <Stat
          delay={140}
          label="Pedidos novos"
          value={<Numero value={n.novos} duration={900} />}
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
          delay={210}
          label="Lista de espera"
          value={<Numero value={n.listaTotal} duration={1000} />}
          note={n.listaTotal > 0 ? `${n.listaOnline} pela plataforma · ${n.listaOffline} por telefone ou presencialmente` : 'Ninguém inscrito'}
        />
        <Stat delay={280} label="Visualizações" value={<Numero value={n.visualizacoes} format={(v) => num(Math.round(v))} />} note="da ficha, nos últimos 30 dias" />
        <Stat
          delay={350}
          label="Receita mensal em risco"
          value={<Numero value={n.receita} format={(v) => euro(Math.round(v))} />}
          note={n.receita > 0 ? `por cada mês com ${n.livres === 1 ? 'o lugar livre vazio' : `os ${n.livres} lugares livres vazios`}` : 'Todos os lugares ocupados'}
        />
      </dl>
    </section>
  )
}
