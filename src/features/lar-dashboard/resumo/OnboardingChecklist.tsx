import { Link, useSearchParams } from 'react-router'
import { ArrowRight, Check, X } from 'lucide-react'
import type { Lar, User } from '@/types'
import { azulejoBg } from '@/components/brand/patterns'
import { cn } from '@/lib/cn'
import { useLocalFlag } from '../lib/hooks'

interface Passo {
  id: string
  titulo: string
  texto: string
  to: string
  cta: string
  feito: boolean
}

export function passosArranque(lar: Lar, user: User | null): Passo[] {
  const vagasIndicadas =
    lar.quartos.some((q) => q.livres > 0) || !user || new Date(lar.atualizadoEm).getTime() - new Date(user.criadoEm).getTime() > 5_000
  return [
    {
      id: 'ficha',
      titulo: 'Complete a ficha',
      texto: 'Uma frase de apresentação, a descrição da casa e os cuidados de saúde que assegura. É o que decide se a família lhe telefona.',
      to: '/gestao/ficha',
      cta: 'Completar a ficha',
      feito: Boolean(lar.resumo.trim() && lar.descricao.trim() && lar.cuidados.length > 0),
    },
    {
      id: 'vagas',
      titulo: 'Indique os lugares livres',
      texto: 'Mesmo que hoje não tenha nenhum: confirmar «0 livres» diz às famílias que a informação é verdadeira.',
      to: '/gestao/vagas',
      cta: 'Indicar vagas',
      feito: vagasIndicadas,
    },
    {
      id: 'precos',
      titulo: 'Reveja os preços por quarto',
      texto: 'Mensalidade mínima e máxima de cada tipo de quarto. As famílias filtram pelo orçamento.',
      to: '/gestao/vagas',
      cta: 'Rever preços',
      feito: lar.quartos.length > 0 && lar.quartos.every((q) => q.precoMin > 0 && q.precoMax >= q.precoMin),
    },
  ]
}

/** Lista de arranque para instituições acabadas de registar (?bemvindo=1) ou com a ficha por completar. */
export function OnboardingChecklist({ lar, user }: { lar: Lar; user: User | null }) {
  const [params, setParams] = useSearchParams()
  const [dispensado, setDispensado] = useLocalFlag(`arranque-dispensado:${lar.id}`)
  const passos = passosArranque(lar, user)
  const feitos = passos.filter((p) => p.feito).length
  const bemvindo = params.get('bemvindo') === '1'
  if (!bemvindo && (dispensado || feitos === passos.length)) return null

  const fechar = () => {
    setDispensado(true)
    if (bemvindo) {
      const next = new URLSearchParams(params)
      next.delete('bemvindo')
      setParams(next, { replace: true })
    }
  }
  const primeiroNome = user?.nome.split(' ')[0]

  return (
    <section aria-labelledby="arranque-titulo" className="relative overflow-hidden rounded-3xl border border-pine-200 bg-pine-50 shadow-card">
      <div aria-hidden className="absolute inset-y-0 right-0 hidden w-40 opacity-[0.12] md:block" style={azulejoBg('#1d564e', 1, 56)} />
      <div className="relative p-6 sm:p-8 md:pr-48">
        <button
          type="button"
          onClick={fechar}
          className="absolute top-3 right-3 flex size-12 items-center justify-center rounded-full text-ink-soft hover:bg-white hover:text-ink md:bg-white/70"
          aria-label="Dispensar a lista de arranque"
        >
          <X aria-hidden className="size-6" />
        </button>
        <p className="eyebrow">
          Primeiros passos · {feitos} de {passos.length} feitos
        </p>
        <h2 id="arranque-titulo" className="mt-2 max-w-xl pr-10 font-display text-2xl font-semibold sm:text-3xl">
          {primeiroNome ? `Olá, ${primeiroNome}. ` : ''}A sua ficha está criada — <em>três passos</em> e as famílias passam a encontrá-la.
        </h2>
        <div className="mt-4 flex h-2 w-full max-w-md overflow-hidden rounded-full bg-white" aria-hidden>
          <span className="h-full rounded-full bg-pine-600 transition-[width] duration-500" style={{ width: `${(feitos / passos.length) * 100}%` }} />
        </div>
        <ol className="mt-6 grid gap-4 lg:grid-cols-3">
          {passos.map((p, i) => (
            <li key={p.id} className={cn('flex flex-col rounded-2xl border bg-white p-5', p.feito ? 'border-leaf-200' : 'border-line shadow-soft')}>
              <div className="flex items-center justify-between gap-3">
                <span aria-hidden className={cn('font-display text-4xl leading-none font-semibold', p.feito ? 'text-leaf-600' : 'text-terra-600')}>
                  {i + 1}
                </span>
                {p.feito && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-leaf-50 px-2.5 py-1 text-sm font-bold text-leaf-700">
                    <Check aria-hidden className="size-4" strokeWidth={3} /> Feito
                  </span>
                )}
              </div>
              <h3 className="mt-3 font-sans text-lg font-bold">
                <span className="sr-only">Passo {i + 1}: </span>
                {p.titulo}
                {p.feito && <span className="sr-only"> (feito)</span>}
              </h3>
              <p className="mt-1 flex-1 text-sm text-ink-soft">{p.texto}</p>
              <Link
                to={p.to}
                className={cn(
                  'mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 font-bold transition-colors',
                  p.feito ? 'border-2 border-line text-ink-soft hover:border-pine-500 hover:text-pine-800' : 'bg-pine-700 text-white shadow-soft hover:bg-pine-800',
                )}
              >
                {p.feito ? 'Rever' : p.cta}
                <ArrowRight aria-hidden className="size-5" />
              </Link>
            </li>
          ))}
        </ol>
        {lar.verificacao.estado !== 'verificado' && (
          <p className="mt-5 text-sm text-ink-soft">
            Enquanto isso, a equipa EncontraLar verifica a licença de funcionamento{lar.verificacao.licenca ? ` n.º ${lar.verificacao.licenca}` : ''}. Acompanhe o estado
            da verificação na{' '}
            <Link to="/gestao/ficha#verificacao" className="link">
              ficha pública
            </Link>
            .
          </p>
        )}
      </div>
    </section>
  )
}
