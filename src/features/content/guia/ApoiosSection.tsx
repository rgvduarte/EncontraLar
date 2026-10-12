/**
 * #apoios — comparticipações e apoios. Sem valores: as regras mudam e remetemos sempre para a fonte oficial.
 */
import { Building2, Landmark, Lightbulb, Receipt } from 'lucide-react'
import { AnchorSection, Callout, Confirme, SectionMark } from '../shared/editorial'

interface Apoio {
  nome: string
  entidade: 'Segurança Social' | 'Instituição' | 'Autoridade Tributária'
  oQue: string
  quem: string
  onde: string
  fonte: 'ss' | 'financas'
  nota?: string
}

const APOIOS: Apoio[] = [
  {
    nome: 'Comparticipação familiar nas IPSS e Misericórdias',
    entidade: 'Instituição',
    oQue:
      'Nas vagas com acordo de cooperação com a Segurança Social, a mensalidade não é um preço fixo: é calculada em função dos rendimentos do agregado, segundo regras da Segurança Social e o regulamento interno da instituição.',
    quem: 'Quem entra numa vaga com acordo (lar, centro de dia ou apoio domiciliário).',
    onde: 'Na própria instituição. Peça o regulamento interno e uma simulação por escrito, com os documentos de rendimentos.',
    fonte: 'ss',
    nota: 'Estas vagas têm muita procura: inscreva-se cedo e em mais do que uma instituição.',
  },
  {
    nome: 'Complemento por Dependência',
    entidade: 'Segurança Social',
    oQue:
      'Prestação mensal para pensionistas que precisam da ajuda de outra pessoa nas atividades do dia a dia — higiene, alimentação, deslocações. Tem dois graus, conforme o nível de dependência.',
    quem: 'Pensionistas (de velhice, invalidez ou sobrevivência) em situação de dependência, comprovada por avaliação médica.',
    onde: 'Segurança Social Direta ou num balcão da Segurança Social.',
    fonte: 'ss',
  },
  {
    nome: 'Complemento Solidário para Idosos',
    entidade: 'Segurança Social',
    oQue: 'Apoio mensal que complementa os rendimentos de pessoas idosas com pensões baixas, até um valor de referência definido todos os anos.',
    quem: 'Pessoas a partir da idade legal de reforma, com rendimentos abaixo do limite.',
    onde: 'Segurança Social Direta ou num balcão da Segurança Social.',
    fonte: 'ss',
  },
  {
    nome: 'Estatuto do Cuidador Informal',
    entidade: 'Segurança Social',
    oQue:
      'Reconhece quem cuida de um familiar em situação de dependência e dá acesso a medidas de apoio — como períodos de descanso do cuidador e, para o cuidador principal com rendimentos baixos, um subsídio mensal.',
    quem: 'O familiar que cuida da pessoa (por exemplo, cônjuge, filho ou filha), em casa.',
    onde: 'Segurança Social Direta ou num balcão da Segurança Social.',
    fonte: 'ss',
    nota: 'Útil enquanto a pessoa continua em casa, à espera de vaga.',
  },
  {
    nome: 'Dedução das despesas com lares no IRS',
    entidade: 'Autoridade Tributária',
    oQue:
      'Uma percentagem das mensalidades pagas a lares e instituições de apoio a pessoas idosas pode ser deduzida ao IRS, até um limite anual.',
    quem: 'O próprio residente — ou os filhos que pagam o lar dos pais, quando estes têm rendimentos baixos (há um limite definido na lei).',
    onde: 'No e-Fatura: confirme que as faturas da instituição estão associadas ao NIF de quem paga e na categoria certa, antes de entregar a declaração.',
    fonte: 'financas',
  },
]

const GRUPOS = [
  { entidade: 'Instituição', titulo: 'Pede-se na própria instituição', Icon: Building2 },
  { entidade: 'Segurança Social', titulo: 'Pede-se à Segurança Social', Icon: Landmark },
  { entidade: 'Autoridade Tributária', titulo: 'No IRS', Icon: Receipt },
] as const

export function ApoiosSection() {
  return (
    <AnchorSection id="apoios">
      <SectionMark
        n={4}
        titleId="apoios-titulo"
        eyebrow="Apoios e custos"
        title={
          <>
            Quem ajuda a <em>pagar</em> — e onde se pede
          </>
        }
        lead="O custo é muitas vezes o que mais assusta. Há apoios públicos que podem fazer diferença; os valores mudam todos os anos, por isso indicamos sempre onde confirmar."
      />

      <div className="mt-10 flex flex-col gap-12">
        {GRUPOS.map((g) => (
          <div key={g.entidade}>
            <h3 className="flex items-center gap-3 font-sans text-xs font-bold tracking-[0.12em] text-ink-mute uppercase">
              <span className="flex size-9 items-center justify-center rounded-full bg-pine-50 text-pine-700">
                <g.Icon aria-hidden className="size-4.5" />
              </span>
              {g.titulo}
              <span aria-hidden className="h-px flex-1 bg-line-strong" />
            </h3>
            <ul className="mt-2 flex flex-col divide-y divide-line">
              {APOIOS.filter((a) => a.entidade === g.entidade).map((a) => (
                <li key={a.nome} className="grid gap-5 py-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-10">
                  <div className="flex flex-col gap-3">
                    <h4 className="font-display text-2xl leading-snug font-semibold text-ink">{a.nome}</h4>
                    <p className="text-lg leading-relaxed text-ink-soft">{a.oQue}</p>
                    {a.nota && (
                      <p className="flex gap-2 text-base font-semibold text-pine-800">
                        <Lightbulb aria-hidden className="mt-1 size-4.5 shrink-0" />
                        {a.nota}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-4 rounded-2xl bg-sand/70 p-5">
                    <dl className="flex flex-col gap-4">
                      <div>
                        <dt className="text-xs font-bold tracking-[0.12em] text-ink-mute uppercase">Para quem</dt>
                        <dd className="mt-1 text-base text-ink">{a.quem}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-bold tracking-[0.12em] text-ink-mute uppercase">Onde pedir</dt>
                        <dd className="mt-1 text-base text-ink">{a.onde}</dd>
                      </div>
                    </dl>
                    <Confirme fonte={a.fonte} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <Callout tone="dica" title="Não sabe a que tem direito?" className="mt-8">
        <p>
          A assistente social do centro de saúde ou do hospital, e o serviço de ação social da junta de freguesia ou da câmara municipal, ajudam a
          perceber que apoios se aplicam — e a reunir os documentos. Não precisa de fazer isto sozinho(a).
        </p>
      </Callout>
    </AnchorSection>
  )
}
