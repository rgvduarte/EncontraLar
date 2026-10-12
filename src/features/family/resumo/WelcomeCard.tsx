import { Link } from 'react-router'
import { ArrowRight, Check, X } from 'lucide-react'
import { AzulejoBand } from '@/components/brand/patterns'
import { cn } from '@/lib/cn'

/** Cartão de boas-vindas (?bemvindo=1): três passos concretos, com o que já está feito assinalado. */
export function WelcomeCard({
  nome,
  temPerfil,
  guardados,
  pedidos,
  onClose,
}: {
  nome: string
  temPerfil: boolean
  guardados: number
  pedidos: number
  onClose: () => void
}) {
  const passos = [
    {
      t: 'Descreva a pessoa de quem cuida',
      d: 'Autonomia, cuidados de saúde, zona e orçamento. Os dados de saúde só são partilhados com as instituições a quem pedir vaga.',
      to: '/familia/perfil',
      cta: 'Criar perfil de cuidados',
      feito: temPerfil,
    },
    {
      t: 'Guarde as instituições que lhe interessam',
      d: 'No mapa de vagas, toque no coração. Avisamos assim que abrir vaga numa delas.',
      to: '/pesquisa',
      cta: 'Abrir o mapa de vagas',
      feito: guardados > 0,
    },
    {
      t: 'Peça vaga e marque visita',
      d: 'Na ficha de cada instituição. Acompanha as respostas aqui, em “Pedidos”.',
      to: '/pesquisa?vaga=breve',
      cta: 'Ver instituições com vaga',
      feito: pedidos > 0,
    },
  ]
  return (
    <section aria-labelledby="bemvindo" className="relative animate-fade-up overflow-hidden rounded-[2rem] border border-line bg-white shadow-card">
      <AzulejoBand color="#1d564e" size={40} className="h-4 w-full opacity-40" />
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar boas-vindas"
        className="absolute top-7 right-3 flex size-12 items-center justify-center rounded-full text-ink-soft hover:bg-sand hover:text-ink"
      >
        <X aria-hidden className="size-6" />
      </button>
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="pr-10 lg:pr-0">
          <p className="eyebrow">Conta criada</p>
          <h2 id="bemvindo" className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
            Olá, {nome}. Vamos <em>por partes</em>.
          </h2>
          <p className="mt-3 text-ink-soft">
            Escolher um lar é uma decisão difícil e, muitas vezes, apressada por uma alta hospitalar. Este painel junta num só sítio os
            pedidos, as visitas, as instituições guardadas e os avisos de vaga.
          </p>
        </div>
        <ol className="flex flex-col">
          {passos.map((p, i) => (
            <li key={p.t} className="flex gap-4 border-t border-dashed border-line-strong py-4 first:border-t-0 first:pt-0">
              <span aria-hidden className="w-9 shrink-0 text-center">
                {p.feito ? (
                  <span className="mx-auto mt-1 flex size-8 items-center justify-center rounded-full bg-pine-700 text-white">
                    <Check strokeWidth={3} className="size-4.5" />
                  </span>
                ) : (
                  <span className="font-display text-4xl leading-none font-semibold text-terra-600 tabular">{i + 1}</span>
                )}
              </span>
              <div>
                <p className={cn('text-lg font-bold', p.feito && 'text-ink-soft')}>
                  {p.t}
                  {p.feito && <span className="sr-only"> — feito</span>}
                </p>
                <p className="text-sm text-ink-soft">{p.d}</p>
                {!p.feito && (
                  <Link to={p.to} className="link mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm">
                    {p.cta}
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
