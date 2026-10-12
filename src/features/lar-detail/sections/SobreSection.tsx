import type { Lar } from '@/types'
import { COMODIDADE_ICON } from '@/components/lar/icons'
import { COMODIDADES_ORDEM, COMODIDADE_LABEL, GRAUS_ORDEM, GRAU_LABEL } from '@/lib/labels'
import { num, plural } from '@/lib/format'
import { Secao, Subtitulo } from '../Secao'
import type { DadosLar } from '../helpers'

function grausResumo(lar: Lar): string {
  const g = GRAUS_ORDEM.filter((x) => lar.graus.includes(x))
  if (!g.length) return 'Por indicar'
  const curto = (x: (typeof g)[number]) => (x === 'autonomo' ? 'autónomos' : GRAU_LABEL[x].replace('Dependência ', '').toLowerCase())
  const nomes = g.map(curto)
  const frase = nomes.length === 1 ? nomes[0]! : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]!}`
  return frase.replace(/^./, (c) => c.toUpperCase())
}

export function SobreSection({ lar, dados, numero }: { lar: Lar; dados: DadosLar; numero: number }) {
  const paragrafos = lar.descricao.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const comodidades = COMODIDADES_ORDEM.filter((c) => lar.comodidades.includes(c))
  const anos = lar.fundacao ? new Date().getFullYear() - lar.fundacao : 0

  const factos = [
    { termo: 'Capacidade', valor: lar.capacidade ? num(lar.capacidade) : '—', nota: dados.centroDia ? 'lugares de dia' : 'residentes' },
    { termo: 'Fundação', valor: lar.fundacao ? String(lar.fundacao) : '—', nota: anos > 1 ? `há ${anos} anos` : anos === 1 ? 'há 1 ano' : 'abriu este ano' },
    { termo: 'Graus aceites', valor: grausResumo(lar), nota: 'de dependência', texto: true },
  ]

  return (
    <Secao
      id="ficha-sobre"
      numero={numero}
      rotulo="Sobre"
      titulo={
        <>
          Conhecer a <em>casa</em>
        </>
      }
    >
      <dl className="mb-10 grid grid-cols-2 border-y border-line sm:grid-cols-[1fr_1fr_1.6fr]">
        {factos.map((f, i) => (
          <div
            key={f.termo}
            className={`flex flex-col gap-1 py-4 ${i > 0 ? 'sm:border-l sm:border-line sm:pl-6' : ''} ${i === 1 ? 'border-l border-line pl-4 sm:pl-6' : ''} ${i === 2 ? 'col-span-2 border-t border-line sm:col-span-1 sm:border-t-0' : ''}`}
          >
            <dt className="text-xs font-bold tracking-[0.12em] text-ink-mute uppercase">{f.termo}</dt>
            <dd className={f.texto ? 'font-display text-xl leading-snug font-semibold text-ink' : 'font-display text-4xl leading-none font-semibold text-ink tabular'}>
              {f.valor}
            </dd>
            <dd className="text-sm text-ink-soft">{f.nota}</dd>
          </div>
        ))}
      </dl>

      {paragrafos.length ? (
        <div className="max-w-[68ch] space-y-5 text-lg leading-relaxed text-ink">
          {paragrafos.map((p, i) => (
            <p
              key={i}
              className={
                i === 0
                  ? 'first-letter:float-left first-letter:mt-1.5 first-letter:mr-3 first-letter:font-display first-letter:text-[4.6rem] first-letter:leading-[0.78] first-letter:font-semibold first-letter:text-terra-600'
                  : undefined
              }
            >
              {p}
            </p>
          ))}
        </div>
      ) : (
        <p className="max-w-2xl rounded-2xl border-2 border-dashed border-line-strong bg-white/60 p-5 text-ink-soft">
          A instituição ainda não escreveu a sua apresentação. Para já, pode ver abaixo os cuidados, os preços e a previsão de vagas — ou ligar e perguntar
          como é o dia a dia.
        </p>
      )}

      {comodidades.length > 0 && (
        <div className="mt-10">
          <Subtitulo>
            {dados.centroDia ? 'No centro' : 'Na casa'}{' '}
            <span className="font-sans text-base font-normal text-ink-mute">· {plural(comodidades.length, 'comodidade', 'comodidades')}</span>
          </Subtitulo>
          <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
            {comodidades.map((c) => {
              const Icon = COMODIDADE_ICON[c]
              return (
                <li key={c} className="flex items-center gap-3 border-b border-line py-3">
                  <Icon aria-hidden className="size-5 shrink-0 text-pine-700" strokeWidth={1.8} />
                  <span>{COMODIDADE_LABEL[c]}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Secao>
  )
}
