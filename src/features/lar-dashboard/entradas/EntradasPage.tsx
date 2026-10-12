import { useMemo, type ReactNode } from 'react'
import { Check, Clock } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Reveal } from '@/components/motion'
import { tempoRelativo } from '@/lib/format'
import { entradaAtribuida, entradaVerificada, origemDe, taxaPara } from '@/lib/negocio'
import { cn } from '@/lib/cn'
import { entradasDoLar, entradasUltimos12Meses } from '../lib/derive'
import { useAgora } from '../lib/hooks'
import { Numero } from '../shared/motion'
import { diaCurto, verPedidoHref } from '../shared/pedidoBits'
import { MoreLink, SectionTitle } from '../shared/ui'
import { TAXA_TEXTO } from '../pedidos/EntradaModal'
import { PedidoAcoes } from '../pedidos/PedidoAcoes'

/** "Família" ou "Encaminhado por <organização>". */
const origemTexto = (c: Candidatura) => (origemDe(c) === 'profissional' && c.encaminhamento ? `Encaminhado por ${c.encaminhamento.organizacao}` : 'Família')

/** Um lado da confirmação: "Instituição ✓" / "Família — por confirmar" (sempre com texto, nunca só o ícone). */
function Lado({ nome, feito }: { nome: string; feito: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1', feito ? 'text-ink' : 'text-ink-mute')}>
      {nome}
      {feito ? (
        <>
          <Check aria-hidden className="size-4 text-leaf-600" strokeWidth={2.75} />
          <span className="sr-only"> confirmou</span>
        </>
      ) : (
        <>
          <Clock aria-hidden className="size-4" strokeWidth={1.75} />
          <span className="sr-only"> ainda não confirmou</span>
        </>
      )}
    </span>
  )
}

function Campo({ k, children, className }: { k: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-sm text-ink-mute">{k}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}

function LinhaEntrada({ c, lar, agora, indice }: { c: Candidatura; lar: Lar; agora: number; indice: number }) {
  const e = c.entrada!
  const verificada = entradaVerificada(c)
  const conta = entradaAtribuida(c)
  const familia = c.encaminhamento ? 'Quem encaminhou' : 'Família'
  return (
    <li>
      <Reveal variant="fade" delay={Math.min(indice, 4) * 70} duration={800}>
        <article aria-labelledby={`entrada-${c.id}`} className="py-7">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h3 id={`entrada-${c.id}`} className="text-xl font-semibold">
              {c.perfil.nome}, {c.perfil.idade} anos
            </h3>
            <MoreLink to={verPedidoHref(c)} aria-label={`Ver o pedido de ${c.perfil.nome}`} className="text-base">
              Ver pedido
            </MoreLink>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:gap-x-8 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1.2fr)]">
            <Campo k="Entrou a">
              <span className="font-medium">{diaCurto(e.data, agora)}</span>
            </Campo>
            <Campo k="Origem">{origemTexto(c)}</Campo>
            <Campo k="Confirmações" className="max-sm:col-span-2">
              <span className="flex flex-wrap items-center gap-x-2">
                <Lado nome="Instituição" feito={!!e.confirmadaLarEm} />
                <span aria-hidden className="text-ink-mute">
                  ·
                </span>
                <Lado nome={familia} feito={!!e.confirmadaFamiliaEm} />
              </span>
              <span className={cn('mt-0.5 block text-sm', verificada ? 'font-medium text-leaf-700' : 'text-ink-mute')}>
                {verificada
                  ? 'Entrada verificada'
                  : e.confirmadaLarEm
                    ? `A aguardar confirmação ${c.encaminhamento ? 'de quem encaminhou' : 'da família'}`
                    : 'A aguardar a sua confirmação'}
              </span>
            </Campo>
            <Campo k="Taxa" className="max-sm:col-span-2">
              {conta ? TAXA_TEXTO[e.taxa] : 'Não conta: entrou mais de 12 meses depois do pedido'}
            </Campo>
          </dl>
          {!e.confirmadaLarEm && <PedidoAcoes c={c} lar={lar} agora={agora} apenasPrincipal verHref={verPedidoHref(c)} className="mt-5 max-sm:w-full" />}
        </article>
      </Reveal>
    </li>
  )
}

/**
 * /gestao/entradas — quem entrou através do EncontraLar: o dia, a origem, as confirmações (casa e família)
 * e a linha da taxa. Sem valores em euros: o valor da taxa está no contrato, não no site.
 */
export default function EntradasPage({ lar, cands }: { lar: Lar; cands: Candidatura[] }) {
  const agora = useAgora()
  const todas = useMemo(() => entradasDoLar(cands), [cands])
  const ano = useMemo(() => entradasUltimos12Meses(cands, agora), [cands, agora])
  const porMarcar = useMemo(() => cands.filter((c) => c.estado === 'aceite').sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm)), [cands])
  const verificadas = ano.filter(entradaVerificada).length
  const aguardar = ano.length - verificadas
  const taxa = taxaPara(lar)

  return (
    <div className="flex flex-col gap-14 sm:gap-16">
      <Reveal variant="blur">
        <section aria-labelledby="entradas-total">
          <h2 id="entradas-total" className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Numero value={ano.length} duration={900} className="text-5xl leading-none font-semibold tracking-tight sm:text-6xl" />
            <span className="max-w-xl text-xl leading-snug font-semibold text-ink-mute sm:text-2xl">
              {ano.length === 1 ? 'pessoa entrou' : 'pessoas entraram'} através do EncontraLar nos últimos 12 meses
            </span>
          </h2>
          {ano.length > 0 && (
            <p className="mt-4 text-ink-mute">
              {verificadas === 1 ? '1 entrada verificada' : `${verificadas} entradas verificadas`}
              {aguardar > 0 && ` · ${aguardar} a aguardar confirmação`}
            </p>
          )}
        </section>
      </Reveal>

      {porMarcar.length > 0 && (
        <section aria-labelledby="entradas-por-marcar">
          <SectionTitle id="entradas-por-marcar" title="Por marcar" text="Vagas aceites. No dia em que a pessoa entrar, marque a entrada." />
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {porMarcar.map((c) => (
              <li key={c.id} className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold">
                    {c.perfil.nome}, {c.perfil.idade} anos
                  </h3>
                  <p className="text-ink-mute">
                    Vaga aceite {tempoRelativo(c.atualizadaEm, new Date(agora))} · {origemTexto(c)}
                  </p>
                </div>
                <PedidoAcoes c={c} lar={lar} agora={agora} apenasPrincipal verHref={verPedidoHref(c)} className="shrink-0 max-sm:w-full" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="entradas-lista">
        <SectionTitle id="entradas-lista" title="Entradas registadas" text={todas.length ? 'Da mais recente para a mais antiga.' : undefined} />
        {todas.length === 0 ? (
          <p className="mt-6 max-w-2xl border-t border-line pt-6 text-ink-mute">
            Ainda não há entradas. Quando uma vaga aceite der lugar a uma entrada, marque-a no pedido: aparece aqui.
          </p>
        ) : (
          <ol className="mt-4 divide-y divide-line border-t border-line">
            {todas.map((c, i) => (
              <LinhaEntrada key={c.id} c={c} lar={lar} agora={agora} indice={i} />
            ))}
          </ol>
        )}
      </section>

      <Reveal>
        <section aria-labelledby="entradas-como" className="tile">
          <h2 id="entradas-como" className="text-xl font-semibold">
            Como funciona
          </h2>
          <div className="mt-3 flex max-w-2xl flex-col gap-3 text-ink-soft">
            <p>
              Estar no EncontraLar é gratuito. As instituições privadas pagam uma taxa fixa por cada pessoa que entra através da plataforma: sem mensalidade e
              sem percentagem. IPSS e Misericórdias não pagam.
            </p>
            <p>
              Só conta a entrada que acontece até 12 meses depois do primeiro pedido feito aqui, confirmada pela instituição ou pela família. Com as duas
              confirmações, a entrada fica verificada e a família pode deixar uma avaliação verificada.
            </p>
          </div>
          <p className="mt-4 font-medium">A sua instituição: {TAXA_TEXTO[taxa]}</p>
        </section>
      </Reveal>
    </div>
  )
}
