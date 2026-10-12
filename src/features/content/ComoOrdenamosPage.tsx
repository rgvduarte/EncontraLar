/**
 * /como-ordenamos — transparência da ordenação (docs/MODELO-NEGOCIO.md: "Ninguém paga para aparecer primeiro").
 * Descreve o que o código faz de facto: `ordenar` em features/search/filtering.ts e os pesos de lib/matching.ts.
 * Se a ordenação mudar, esta página muda com ela.
 */
import { useState, type ReactNode } from 'react'
import { useDocumentTitle } from '@/lib/hooks'
import { PESOS } from '@/lib/matching'
import { ORDEM_LABEL, ORDENS, type Ordem } from '@/features/search/searchState'
import { ButtonLink } from '@/components/ui/Button'
import { SeloVerificado } from '@/components/brand/SeloVerificado'
import { Reveal } from '@/components/motion'
import { MoreLink, PageHero } from './shared/ui'

const RESUMO = [
  'Por omissão, primeiro quem tem vaga para quem pede hoje.',
  'Em caso de empate, vêm primeiro as vagas confirmadas há menos tempo.',
  'O que as instituições pagam não conta para a ordem.',
] as const

/** O que cada opção de «Ordenar» faz (a mesma ordem e os mesmos nomes da pesquisa). */
const ORDEM_TEXTO: Record<Ordem, string> = {
  relevancia:
    'É a ordem por omissão. Primeiro as instituições com vaga para quem pede hoje, depois as que têm vaga prevista em breve e, por fim, as que só têm lista de espera. Dentro de cada grupo, as mais bem avaliadas pelas famílias. Em caso de empate, aparecem primeiro as que confirmaram as vagas há menos tempo.',
  distancia: 'Da mais perto para a mais longe do local que escolheu. Só aparece quando a pesquisa tem um local. Os empates seguem a relevância.',
  disponibilidade: 'Pela espera estimada: primeiro as vagas imediatas, depois as esperas mais curtas. Em caso de empate, a mais bem avaliada.',
  preco: 'Da mensalidade de partida mais baixa para a mais alta. Nas IPSS e Misericórdias conta o valor mínimo, que depende dos rendimentos. Os empates seguem a relevância.',
  avaliacao: 'Pela nota média das famílias. Em caso de empate, a que tem mais avaliações.',
}

const FATORES: { k: keyof typeof PESOS; t: string; d: string }[] = [
  { k: 'cuidados', t: 'Cuidados de saúde', d: 'Os cuidados de que a pessoa precisa. Os essenciais contam a dobrar.' },
  { k: 'orcamento', t: 'Orçamento', d: 'A mensalidade do quarto pretendido, face ao orçamento.' },
  { k: 'distancia', t: 'Distância', d: 'A distância ao local escolhido, dentro ou fora do raio.' },
  { k: 'disponibilidade', t: 'Disponibilidade', d: 'A vaga para quem pede hoje, conforme a urgência.' },
  { k: 'preferencias', t: 'Preferências', d: 'Comodidades e tipo de quarto.' },
]

const CHAVE_ULTIMA_PESQUISA = 'encontralar:ultima-pesquisa'

/** A última pesquisa da sessão (ex.: "/pesquisa?lugar=Porto"), para voltar aos mesmos resultados. */
function ultimaPesquisa(): string | null {
  try {
    const v = sessionStorage.getItem(CHAVE_ULTIMA_PESQUISA)
    if (v && /^\/pesquisa(\?|$)/.test(v)) return v
  } catch {
    /* sem armazenamento: usa a pesquisa vazia */
  }
  return null
}

function Bloco({ titulo, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <Reveal as="section" variant="fade" duration={800} className="border-t border-line py-10 sm:py-14 print:!opacity-100">
      <div className="flex items-center justify-between gap-6">
        <h2 className="text-2xl font-semibold text-ink sm:text-3xl">{titulo}</h2>
        {extra}
      </div>
      <div className="mt-5 flex flex-col gap-4 text-lg leading-relaxed text-ink-soft [&_strong]:font-semibold [&_strong]:text-ink">{children}</div>
    </Reveal>
  )
}

export default function ComoOrdenamosPage() {
  useDocumentTitle('Como ordenamos')
  const [voltar] = useState(ultimaPesquisa)

  return (
    <>
      <PageHero
        eyebrow="Como ordenamos"
        title="Ninguém paga para aparecer primeiro."
        subtitle="O que decide a ordem dos resultados, sem letra pequena."
        titleWidth="max-w-[15ch]"
      >
        <ul className="mx-auto flex max-w-[44ch] flex-col gap-2 text-left text-lg text-ink sm:text-center">
          {RESUMO.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </PageHero>

      <div className="container-narrow pb-20 sm:pb-32">
        <div className="mx-auto max-w-[44rem]">
          <Bloco titulo="As opções de ordenação">
            <p>
              Na pesquisa, escolhe a ordem em <strong>Ordenar</strong>. Os filtros decidem que instituições aparecem; a ordenação decide só a
              sequência.
            </p>
            <dl className="flex flex-col">
              {ORDENS.map((o) => (
                <div key={o} className="border-t border-line py-5 first:border-t-0 first:pt-1">
                  <dt className="font-semibold text-ink">{ORDEM_LABEL[o]}</dt>
                  <dd className="mt-1">{ORDEM_TEXTO[o]}</dd>
                </div>
              ))}
            </dl>
            <p className="text-base text-ink-mute">
              «Com vaga» quer dizer vaga para quem pede hoje. Um lugar livre já prometido a quem está na lista de espera aparece como «lista à
              frente», e não como vaga.
            </p>
          </Bloco>

          <Bloco titulo="No questionário «Ajuda-me a escolher»">
            <p>
              Aqui a ordem é a <strong>compatibilidade</strong> com a pessoa de quem cuida. Cada instituição recebe até 100 pontos:
            </p>
            <ul className="flex flex-col gap-5">
              {FATORES.map((f) => (
                <li key={f.k}>
                  <p className="flex items-baseline justify-between gap-4">
                    <span className="font-semibold text-ink">{f.t}</span>
                    <span className="shrink-0 font-semibold text-ink tabular">{PESOS[f.k]} pontos</span>
                  </p>
                  <span aria-hidden className="mt-2 block h-1.5 overflow-hidden rounded-full bg-sand-deep">
                    <span className="block h-full rounded-full bg-ink" style={{ width: `${PESOS[f.k]}%` }} />
                  </span>
                  <p className="mt-2 text-base text-ink-mute">{f.d}</p>
                </li>
              ))}
            </ul>
            <p>
              Se a instituição não admite o grau de dependência, não assegura um cuidado essencial (como enfermagem 24 horas ou cuidados na demência)
              ou fica mais de 50% acima do orçamento, passa para o fim da lista, com o motivo à vista.
            </p>
            <MoreLink to="/encontrar" className="self-start">
              Responder ao questionário
            </MoreLink>
          </Bloco>

          <Bloco
            titulo="O que quer dizer «Verificado»"
            extra={
              <span aria-hidden className="shrink-0">
                <SeloVerificado size={48} />
              </span>
            }
          >
            <p>
              Visitámos a instituição, confirmámos a licença de funcionamento emitida pela Segurança Social e comparámos os preços publicados com os
              entregues às famílias. O selo mostra a data da visita e renova-se todos os anos.
            </p>
            <p>O selo não se compra. Sem ele, a informação da ficha é a que a própria instituição nos deu.</p>
          </Bloco>

          <Bloco titulo="Como funcionam as avaliações">
            <p>
              Só avaliam famílias que fizeram um pedido ou têm um familiar na instituição. A marca <strong>Verificada</strong> indica que a entrada do
              familiar foi confirmada através do EncontraLar.
            </p>
            <p>
              Cada avaliação dá uma nota de 1 a 5 e avalia quatro aspetos: cuidados, alimentação, instalações e comunicação. As instituições não
              escolhem que avaliações aparecem.
            </p>
          </Bloco>

          <Reveal variant="scale" className="mt-6 rounded-[1.75rem] bg-sand p-6 sm:p-10 print:!opacity-100">
            <h2 className="text-2xl font-semibold text-ink sm:text-3xl">Não há posições pagas.</h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-soft">
              Nenhuma instituição paga para subir na lista. A taxa que os lares privados pagam por cada pessoa que entra não conta para a ordem, e o
              selo de verificação não se compra.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-ink-soft">
              Se um dia houver lugares pagos, vão estar sempre assinalados de forma clara e nunca misturados na ordenação, em cumprimento das regras
              europeias de transparência para plataformas em linha.
            </p>
          </Reveal>

          <div className="mt-12 flex flex-col items-stretch gap-x-8 gap-y-2 sm:mt-16 sm:flex-row sm:items-center">
            <ButtonLink to={voltar ?? '/pesquisa'} size="lg" className="w-full sm:w-auto">
              {voltar ? 'Voltar à pesquisa' : 'Ver o mapa de vagas'}
            </ButtonLink>
            <MoreLink to="/para-lares#quanto-custa" className="justify-center text-lg">
              Quanto custa para as instituições
            </MoreLink>
          </div>
        </div>
      </div>
    </>
  )
}
