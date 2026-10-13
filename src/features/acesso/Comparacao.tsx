/**
 * Grátis vs Acesso Família. Desktop: tabela com visto e travessão (e o estado em texto para leitores de ecrã),
 * nada só por cor. Telemóvel: lista empilhada, um cartão por versão.
 * O subtítulo usa uma contagem agregada (o "quantas", nunca o "quais"), que a versão grátis pode mostrar.
 */
import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { PLANOS_FAMILIA, precoTexto, resumoDisponibilidade } from '@/lib/acesso'
import { useLares } from '@/lib/store'
import { plural } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Reveal } from '@/components/motion'
import { SectionTitle } from '@/features/content/shared/ui'
import { COMPARACAO, type LinhaComparacao } from './conteudo'
import { Equilibrado } from './texto'

const DESDE = `desde ${precoTexto(Math.min(...PLANOS_FAMILIA.map((p) => p.precoCentimos)))}`

/** Visto ou travessão. Com `texto`, diz o estado aos leitores de ecrã (na tabela); sem ele, é só desenho. */
function Marca({ incluido, texto = false, escuro = false }: { incluido: boolean; texto?: boolean; escuro?: boolean }) {
  return (
    <span className="relative inline-flex size-7 shrink-0 items-center justify-center">
      {incluido ? (
        <Check aria-hidden strokeWidth={2.25} className={cn('size-6', escuro ? 'text-white' : 'text-ink')} />
      ) : (
        <span aria-hidden className="text-xl leading-none font-medium text-ink-mute">
          —
        </span>
      )}
      {texto && <span className="sr-only">{incluido ? 'Incluído' : 'Não incluído'}</span>}
    </span>
  )
}

function Tabela() {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">O que inclui a versão grátis e o que inclui o Acesso Família</caption>
      <colgroup>
        <col />
        <col className="w-36 lg:w-44" />
        <col className="w-36 lg:w-44" />
      </colgroup>
      <thead>
        <tr>
          <td />
          <th scope="col" className="pt-6 pb-2 text-center align-top text-xl font-semibold text-ink">
            Grátis
          </th>
          <th scope="col" className="pt-6 pb-2 text-center align-top text-xl font-semibold text-ink">
            Acesso Família
            <span className="mt-0.5 block text-base font-normal text-ink-mute">{DESDE}</span>
          </th>
        </tr>
      </thead>
      {COMPARACAO.map((g) => (
        <tbody key={g.id}>
          <tr>
            <th scope="rowgroup" colSpan={3} className="pt-9 pb-3 text-left text-base font-semibold text-ink-mute">
              {g.titulo}
            </th>
          </tr>
          {g.linhas.map((l) => (
            <tr key={l.t} className="border-t border-line">
              <th scope="row" className="py-4 pr-6 text-left text-lg font-normal text-ink">
                {l.t}
                {l.nota && <span className="mt-0.5 block text-base text-ink-mute">{l.nota}</span>}
              </th>
              <td className="py-4 text-center">
                <Marca incluido={g.gratis} texto />
              </td>
              <td className="py-4 text-center">
                <Marca incluido texto />
              </td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  )
}

function Item({ linha, incluido, escuro = false }: { linha: LinhaComparacao; incluido: boolean; escuro?: boolean }) {
  return (
    <li className={cn('flex gap-3 border-t py-3 first:border-t-0', escuro ? 'border-white/15' : 'border-line')}>
      <Marca incluido={incluido} escuro={escuro} />
      <span className={cn('pt-0.5 text-lg leading-snug', escuro ? 'text-white' : incluido ? 'text-ink' : 'text-ink-mute')}>
        {linha.t}
        {linha.nota && <span className={cn('mt-0.5 block text-base', escuro ? 'text-pine-300' : 'text-ink-mute')}>{linha.nota}</span>}
      </span>
    </li>
  )
}

/** Telemóvel: cada versão é um cartão; os títulos "Inclui" / "Não inclui" dizem o estado (as marcas são desenho). */
function ListaEmpilhada({ className }: { className?: string }) {
  const gratis = COMPARACAO.filter((g) => g.gratis).flatMap((g) => g.linhas)
  const pagos = COMPARACAO.filter((g) => !g.gratis).flatMap((g) => g.linhas)
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <Reveal className="rounded-[1.75rem] bg-white p-6">
        <h3 className="text-2xl font-semibold text-ink">Grátis</h3>
        <p className="mt-1 text-lg text-ink-mute">Para conhecer as opções.</p>
        <h4 className="mt-6 text-base font-semibold text-ink-mute">Inclui</h4>
        <ul className="mt-1">
          {gratis.map((l) => (
            <Item key={l.t} linha={l} incluido />
          ))}
        </ul>
        <h4 className="mt-6 text-base font-semibold text-ink-mute">Não inclui</h4>
        <ul className="mt-1">
          {pagos.map((l) => (
            <Item key={l.t} linha={l} incluido={false} />
          ))}
        </ul>
      </Reveal>
      <Reveal className="on-dark rounded-[1.75rem] bg-pine-950 p-6 text-white">
        <h3 className="text-2xl font-semibold text-white">Acesso Família</h3>
        <p className="mt-1 text-lg text-pine-300">{DESDE}</p>
        <h4 className="mt-6 text-base font-semibold text-pine-300">Inclui</h4>
        <ul className="mt-1">
          <Item linha={{ t: 'Tudo o que a versão grátis inclui' }} incluido escuro />
          {pagos.map((l) => (
            <Item key={l.t} linha={l} incluido escuro />
          ))}
        </ul>
      </Reveal>
    </div>
  )
}

export function Comparacao() {
  const lares = useLares()
  const { comVaga } = useMemo(() => resumoDisponibilidade(lares), [lares])
  const subtitulo =
    comVaga > 0
      ? `Neste momento, ${plural(comVaga, 'instituição tem', 'instituições têm')} vaga para quem pede hoje. A versão grátis diz quantas; o Acesso Família diz quais.`
      : 'A versão grátis diz quantas instituições têm vaga; o Acesso Família diz quais.'

  return (
    <section aria-labelledby="acesso-comparacao" className="bg-sand">
      <div className="container-page py-20 sm:py-32 lg:py-40">
        <Reveal variant="blur">
          <SectionTitle id="acesso-comparacao" title="O que inclui cada um." subtitle={<Equilibrado>{subtitulo}</Equilibrado>} />
        </Reveal>
        <Reveal className="mx-auto mt-14 hidden max-w-4xl rounded-[1.75rem] bg-white px-8 pb-4 sm:mt-20 md:block lg:px-12">
          <Tabela />
        </Reveal>
        <ListaEmpilhada className="mt-12 md:hidden" />
      </div>
    </section>
  )
}
