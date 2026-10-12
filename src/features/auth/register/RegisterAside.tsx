import { useMemo } from 'react'
import { HandCoins, ShieldCheck } from 'lucide-react'
import type { Role } from '@/types'
import { AzulejoBand } from '@/components/brand/patterns'
import { useLares } from '@/lib/store'
import { vagasLivres } from '@/lib/forecast'
import { num } from '@/lib/format'
import { cn } from '@/lib/cn'
import { InstitutionPreview, type InstitutionDraft } from './InstitutionPreview'

const BENEFICIOS: Record<Role, { titulo: string; texto: string }[]> = {
  familia: [
    {
      titulo: 'Alertas de vaga',
      texto: 'Guarde os lares que lhe interessam. Quando um deles indicar uma vaga, recebe o aviso — sem ter de telefonar todas as semanas.',
    },
    {
      titulo: 'Pedidos e lista de espera',
      texto: 'Envie pedidos e marque visitas. Vê o estado de cada um e, quando já está inscrito(a), a posição na lista de espera.',
    },
    {
      titulo: 'Perfil de cuidados',
      texto: 'Descreva uma vez o que a pessoa precisa — demência, mobilidade, diabetes — e use-o em todos os pedidos. Mostramos os lares compatíveis.',
    },
  ],
  lar: [
    {
      titulo: 'Painel de vagas',
      texto: 'Atualize os lugares livres num toque. Quem segue a instituição ou está na lista de espera é avisado de imediato.',
    },
    {
      titulo: 'Lista de espera digital',
      texto: 'Os pedidos chegam já com o perfil clínico: grau de dependência, necessidades e urgência. Proponha a vaga e registe a resposta.',
    },
    {
      titulo: 'Previsão de vagas',
      texto: 'Uma estimativa das saídas nos próximos meses, a partir do vosso histórico, para planear entradas e evitar camas vazias.',
    },
  ],
}

function ListaEditorial({ itens, compacta, className }: { itens: { titulo: string; texto: string }[]; compacta?: boolean; className?: string }) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {itens.map((b, i) => (
        <li
          key={b.titulo}
          className={cn(
            'grid gap-x-3 border-t border-line-strong/50 first:border-t-0 first:pt-0 last:pb-0',
            compacta ? 'grid-cols-[2.25rem_1fr] items-baseline py-3' : 'grid-cols-[3rem_1fr] py-5',
          )}
        >
          <span aria-hidden className={cn('font-display leading-none font-semibold text-terra-500 tabular', compacta ? 'text-2xl' : 'text-4xl')}>
            {String(i + 1).padStart(2, '0')}
          </span>
          {compacta ? (
            <h3 className="text-base leading-snug font-bold text-ink">{b.titulo}</h3>
          ) : (
            <div>
              <h3 className="font-display text-xl leading-snug font-semibold text-ink">{b.titulo}</h3>
              <p className="mt-1 text-ink-soft">{b.texto}</p>
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}

/** Painel lateral do registo: o que cada conta recebe + garantias. Para instituições, inclui a pré-visualização ao vivo. */
export function RegisterAside({ tipo, draft }: { tipo: Role | null; draft: InstitutionDraft | null }) {
  const lares = useLares()
  const stats = useMemo(() => {
    const comVaga = lares.filter((l) => l.tipo !== 'centro_dia' && vagasLivres(l) > 0).length
    const distritos = new Set(lares.map((l) => l.distrito)).size
    return { comVaga, total: lares.length, distritos }
  }, [lares])

  return (
    <aside aria-labelledby="aside-titulo" className="flex h-full flex-col gap-6">
      <div className={cn('overflow-hidden rounded-[2rem] border border-line bg-sand', tipo === 'familia' && 'lg:sticky lg:top-28')}>
        <AzulejoBand color="#b9472f" opacity={0.45} size={36} className="h-9 border-b border-line bg-terra-50" />
        <div className="p-6 sm:p-8">
          <p className="flex items-center gap-2.5 text-sm font-semibold text-ink-soft">
            <span aria-hidden className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-leaf-500 opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2.5 rounded-full bg-leaf-500" />
            </span>
            {tipo === 'lar'
              ? `${num(stats.total)} instituições de ${stats.distritos} distritos já estão no mapa`
              : `Hoje, ${num(stats.comVaga)} lares e residências indicam ter vaga`}
          </p>
          <h2 id="aside-titulo" className="mt-4 font-display text-3xl font-semibold text-ink">
            {tipo === 'lar' ? (
              <>
                O que a instituição <em>ganha</em>
              </>
            ) : tipo === 'familia' ? (
              <>
                O que a conta <em>faz</em> por si
              </>
            ) : (
              <>
                Duas contas, <em>dois</em> lados da procura
              </>
            )}
          </h2>

          {tipo ? (
            <ListaEditorial itens={BENEFICIOS[tipo]} className="mt-6" />
          ) : (
            <div className="mt-6 flex flex-col gap-6">
              <div>
                <p className="eyebrow mb-3">Para famílias</p>
                <ListaEditorial itens={BENEFICIOS.familia} compacta />
              </div>
              <div>
                <p className="eyebrow mb-3">Para instituições</p>
                <ListaEditorial itens={BENEFICIOS.lar} compacta />
              </div>
            </div>
          )}

          <ul className="mt-8 flex flex-col gap-4 border-t border-line-strong/50 pt-6 text-sm">
            {tipo !== 'lar' && (
              <li className="flex gap-3">
                <HandCoins aria-hidden className="mt-0.5 size-5 shrink-0 text-pine-700" />
                <span>
                  <strong className="text-ink">Gratuito para famílias.</strong>{' '}
                  <span className="text-ink-soft">Pesquisar, guardar, pedir vaga e receber alertas não tem custo.</span>
                </span>
              </li>
            )}
            <li className="flex gap-3">
              <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-pine-700" />
              <span>
                <strong className="text-ink">Dados de saúde protegidos (RGPD, art. 9.º).</strong>{' '}
                <span className="text-ink-soft">
                  {tipo === 'lar'
                    ? 'Os perfis clínicos chegam apenas às instituições que a família escolheu e servem só para avaliar o pedido.'
                    : 'Só seguem para as instituições a quem envia um pedido. Pode apagar o perfil quando quiser.'}
                </span>
              </span>
            </li>
          </ul>
        </div>
      </div>

      {tipo === 'lar' && draft && (
        <div className="sticky top-28 hidden lg:block">
          <p className="eyebrow mb-3">Assim vai aparecer</p>
          <InstitutionPreview draft={draft} />
        </div>
      )}
    </aside>
  )
}
