/**
 * Planos — tabela comparativa (desktop) e cartões por plano (telemóvel).
 * Preços indicativos do protótipo, assinalados como tal.
 */
import { Check, Minus, Calculator } from 'lucide-react'
import type { Lar } from '@/types'
import { ButtonLink } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { euro } from '@/lib/format'
import { QUARTO_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'

type PlanoId = 'essencial' | 'profissional' | 'rede'

const PLANOS: { id: PlanoId; nome: string; preco: string; periodo?: string; para: string; cta: { label: string; to: string } }[] = [
  { id: 'essencial', nome: 'Essencial', preco: 'Gratuito', para: 'Para estar no mapa e receber pedidos.', cta: { label: 'Começar grátis', to: '/registar?tipo=lar' } },
  {
    id: 'profissional',
    nome: 'Profissional',
    preco: '39 €',
    periodo: '/mês',
    para: 'Para preencher vagas mais depressa e planear entradas.',
    cta: { label: 'Experimentar', to: '/registar?tipo=lar&plano=profissional' },
  },
  { id: 'rede', nome: 'Rede', preco: 'Sob consulta', para: 'Para grupos, Misericórdias e IPSS com várias casas.', cta: { label: 'Pedir proposta', to: '/registar?tipo=lar&plano=rede' } },
]

const GRUPOS: { titulo: string; linhas: { nome: string; nota?: string; em: Partial<Record<PlanoId, true | string>> }[] }[] = [
  {
    titulo: 'Estar no mapa',
    linhas: [
      { nome: 'Ficha completa da instituição', nota: 'preços, cuidados, comodidades, equipa', em: { essencial: true, profissional: true, rede: true } },
      { nome: 'Vagas em tempo real no mapa', em: { essencial: true, profissional: true, rede: true } },
      { nome: 'Pedidos de vaga com perfil clínico', em: { essencial: true, profissional: true, rede: true } },
      { nome: 'Aviso automático às famílias que seguem a casa', em: { essencial: true, profissional: true, rede: true } },
      { nome: 'Selo de verificação', nota: 'igual para todos os planos', em: { essencial: true, profissional: true, rede: true } },
    ],
  },
  {
    titulo: 'Gerir e planear',
    linhas: [
      { nome: 'Lista de espera digital', nota: 'posições, propostas com prazo de 48 h', em: { profissional: true, rede: true } },
      { nome: 'Previsão de vagas da sua casa', em: { profissional: true, rede: true } },
      { nome: 'Destaque nas pesquisas da sua zona', nota: 'sempre assinalado como «Destaque»', em: { profissional: true, rede: true } },
      { nome: 'Estatísticas', nota: 'visitas à ficha, pedidos, conversão', em: { profissional: true, rede: true } },
    ],
  },
  {
    titulo: 'Grupos',
    linhas: [
      { nome: 'Várias instituições numa só conta', em: { rede: true } },
      { nome: 'Painel consolidado e exportação de dados', em: { rede: true } },
      { nome: 'Acompanhamento dedicado', em: { rede: true } },
    ],
  },
]

function Marca({ v, plano }: { v: true | string | undefined; plano: string }) {
  if (v === true)
    return (
      <span className="inline-flex size-8 items-center justify-center rounded-full bg-leaf-100 text-leaf-700">
        <Check aria-hidden className="size-5" strokeWidth={2.5} />
        <span className="sr-only">Incluído no plano {plano}</span>
      </span>
    )
  if (typeof v === 'string') return <span className="text-sm font-semibold text-ink">{v}</span>
  return (
    <span className="inline-flex size-8 items-center justify-center text-line-strong">
      <Minus aria-hidden className="size-5" />
      <span className="sr-only">Não incluído no plano {plano}</span>
    </span>
  )
}

function Preco({ p, className }: { p: (typeof PLANOS)[number]; className?: string }) {
  return (
    <p className={cn('font-display font-semibold text-ink tabular', className)}>
      {p.preco}
      {p.periodo && <span className="font-sans text-base font-normal text-ink-mute">{p.periodo}</span>}
    </p>
  )
}

function Contas({ lar }: { lar: Lar }) {
  // quarto mais barato desta casa: uma semana vazia vs. o custo mensal do plano
  const q = [...lar.quartos].sort((a, b) => a.precoMin - b.precoMin)[0]
  if (!q) return null
  const semana = (q.precoMin / 30) * 7
  const meses = Math.floor(semana / 39)
  return (
    <aside className="flex gap-4 rounded-3xl bg-sand p-6 sm:p-7">
      <Calculator aria-hidden className="mt-1 size-7 shrink-0 text-terra-600" />
      <div>
        <p className="font-display text-2xl font-semibold text-ink">Contas simples</p>
        <p className="mt-2 max-w-[60ch] text-lg text-ink-soft">
          Na {lar.nome}, um {QUARTO_LABEL[q.tipo].replace(' (partilhado)', '').toLowerCase()} custa desde{' '}
          <strong className="text-ink tabular">{euro(q.precoMin)}</strong> por mês. Uma semana a menos com esse quarto vazio são cerca de{' '}
          <strong className="text-ink tabular">{euro(semana)}</strong> — {meses > 1 ? `mais de ${meses} meses` : 'mais de um mês'} do plano
          Profissional.
        </p>
      </div>
    </aside>
  )
}

export function PlansSection({ lar }: { lar?: Lar }) {
  return (
    <section aria-labelledby="pl-planos" className="container-page py-20 sm:py-28">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <p className="eyebrow">Planos</p>
          <h2 id="pl-planos" className="mt-3 text-4xl font-semibold text-ink sm:text-5xl">
            Estar no mapa é <em>gratuito</em>. Para sempre.
          </h2>
        </div>
        <div className="flex flex-col items-start gap-3 lg:col-span-5">
          <Badge tone="sun" size="md">
            Preços indicativos (protótipo)
          </Badge>
          <p className="text-ink-soft">Valores por instituição. As condições finais serão publicadas antes do lançamento.</p>
        </div>
      </div>

      {/* desktop: tabela comparativa */}
      <div className="mt-12 hidden overflow-hidden rounded-3xl border border-line bg-white shadow-card md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Comparação dos planos Essencial, Profissional e Rede (preços indicativos do protótipo)</caption>
          <thead>
            <tr className="align-top">
              <td className="w-[34%] p-6 align-bottom">
                <p className="font-display text-xl font-semibold text-ink">O que cada plano inclui</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-mute">
                  <span className="inline-flex items-center gap-1.5">
                    <Check aria-hidden className="size-4 text-leaf-600" strokeWidth={2.5} /> incluído
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Minus aria-hidden className="size-4" /> não incluído
                  </span>
                </p>
              </td>
              {PLANOS.map((p) => (
                <th
                  key={p.id}
                  scope="col"
                  className={cn('w-[22%] border-l border-line p-6 font-normal', p.id === 'profissional' && 'bg-pine-50')}
                >
                  <span className="flex flex-col items-start gap-2">
                    <span className="flex items-center gap-2 text-sm font-bold tracking-[0.12em] text-ink-mute uppercase">
                      {p.nome}
                      {p.id === 'profissional' && <Badge tone="terra">Recomendado</Badge>}
                    </span>
                    <Preco p={p} className={p.periodo || p.id === 'essencial' ? 'text-3xl lg:text-4xl' : 'text-2xl lg:text-3xl'} />
                    <span className="min-h-12 text-sm text-ink-soft">{p.para}</span>
                    <ButtonLink to={p.cta.to} size="sm" variant={p.id === 'profissional' ? 'primary' : 'secondary'} className="mt-1">
                      {p.cta.label}
                    </ButtonLink>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          {GRUPOS.map((g) => (
            <tbody key={g.titulo}>
              <tr>
                <th colSpan={4} scope="colgroup" className="border-t border-line bg-sand/70 px-6 py-2.5 text-xs font-bold tracking-[0.12em] text-ink-mute uppercase">
                  {g.titulo}
                </th>
              </tr>
              {g.linhas.map((l) => (
                <tr key={l.nome} className="border-t border-line">
                  <th scope="row" className="px-6 py-4 font-normal">
                    <span className="block font-semibold text-ink">{l.nome}</span>
                    {l.nota && <span className="block text-sm text-ink-mute">{l.nota}</span>}
                  </th>
                  {PLANOS.map((p) => (
                    <td key={p.id} className={cn('border-l border-line px-6 py-4', p.id === 'profissional' && 'bg-pine-50/60')}>
                      <Marca v={l.em[p.id]} plano={p.nome} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      {/* telemóvel: um cartão por plano */}
      <ul className="mt-10 flex flex-col gap-5 md:hidden">
        {PLANOS.map((p) => {
          const anterior = p.id === 'profissional' ? 'Essencial' : p.id === 'rede' ? 'Profissional' : null
          const base: PlanoId | null = p.id === 'profissional' ? 'essencial' : p.id === 'rede' ? 'profissional' : null
          const inc = GRUPOS.flatMap((g) => g.linhas).filter((l) => l.em[p.id] && !(base && l.em[base]))
          return (
            <li
              key={p.id}
              className={cn('rounded-3xl border bg-white p-6 shadow-card', p.id === 'profissional' ? 'border-pine-600 ring-2 ring-pine-600' : 'border-line')}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-sans text-sm font-bold tracking-[0.12em] text-ink-mute uppercase">{p.nome}</h3>
                {p.id === 'profissional' && <Badge tone="terra">Recomendado</Badge>}
              </div>
              <Preco p={p} className="mt-2 text-4xl" />
              <p className="mt-1 text-ink-soft">{p.para}</p>
              {anterior && <p className="mt-4 border-t border-line pt-4 font-bold text-ink">Tudo o que inclui o {anterior}, e ainda:</p>}
              <ul className={cn('flex flex-col gap-2', anterior ? 'mt-2' : 'mt-4 border-t border-line pt-4')}>
                {inc.map((l) => (
                  <li key={l.nome} className="flex gap-2.5 text-base text-ink">
                    <Check aria-hidden className="mt-1 size-4.5 shrink-0 text-leaf-600" strokeWidth={2.5} />
                    {l.nome}
                  </li>
                ))}
              </ul>
              <ButtonLink to={p.cta.to} full variant={p.id === 'profissional' ? 'primary' : 'secondary'} className="mt-5">
                {p.cta.label}
              </ButtonLink>
            </li>
          )
        })}
      </ul>

      {lar && (
        <div className="mt-10">
          <Contas lar={lar} />
        </div>
      )}
    </section>
  )
}

