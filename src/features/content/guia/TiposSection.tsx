/**
 * #tipos — Tipos de resposta para pessoas idosas em Portugal, comparados lado a lado.
 */
import { Link } from 'react-router'
import { ArrowRight, DoorOpen, Hospital } from 'lucide-react'
import { AnchorSection, Callout, Prose, SectionMark } from '../shared/editorial'
import { cn } from '@/lib/cn'

interface Resposta {
  nome: string
  sigla?: string
  paraQuem: string
  custo: string
  acesso: string
  direto: boolean
  pesquisa?: string
}

const RESPOSTAS: Resposta[] = [
  {
    nome: 'Lar',
    sigla: 'ERPI',
    paraQuem: 'Quem já não consegue viver em segurança em casa, mesmo com ajuda — da dependência ligeira à grave.',
    custo: 'IPSS e Misericórdias com acordo: em função dos rendimentos. Privados: mensalidade fixa, geralmente mais alta.',
    acesso: 'Pedido direto a cada instituição. Pode inscrever-se em várias ao mesmo tempo.',
    direto: true,
    pesquisa: '/pesquisa?tipo=erpi',
  },
  {
    nome: 'Residência sénior',
    paraQuem: 'Pessoas autónomas ou com pouca dependência que querem segurança, companhia e serviços (refeições, limpeza).',
    custo: 'Quase sempre privada e com preço fixo; costuma ser a opção mais cara.',
    acesso: 'Contacto direto. Confirme sempre que tem licença de funcionamento.',
    direto: true,
    pesquisa: '/pesquisa?tipo=residencia',
  },
  {
    nome: 'Centro de dia',
    paraQuem: 'Quem continua a viver em casa mas precisa de companhia, refeições e cuidados durante o dia.',
    custo: 'Normalmente a resposta mais acessível; nas IPSS, em função dos rendimentos.',
    acesso: 'Pedido direto à instituição. Muitos centros têm transporte de casa e para casa.',
    direto: true,
    pesquisa: '/pesquisa?tipo=centro_dia',
  },
  {
    nome: 'Apoio domiciliário',
    sigla: 'SAD',
    paraQuem: 'Quem quer e pode ficar em casa, com ajuda na higiene, nas refeições, na medicação ou na limpeza.',
    custo: 'Nas IPSS, em função dos rendimentos e dos serviços escolhidos. Nos privados, por hora ou por pacote.',
    acesso: 'Pedido direto à instituição ou empresa que presta o serviço na sua zona.',
    direto: true,
  },
  {
    nome: 'Cuidados continuados',
    sigla: 'RNCCI',
    paraQuem: 'Quem precisa de recuperar ou de cuidados de saúde prolongados após um internamento — por exemplo, depois de um AVC ou de uma fratura.',
    custo: 'Convalescença sem custos para o utente. Média e longa duração: paga a parte de apoio social, em função dos rendimentos.',
    acesso: 'Não se escolhe diretamente: só por referenciação do hospital (equipa de gestão de altas) ou do centro de saúde.',
    direto: false,
  },
]

function Acesso({ direto }: { direto: boolean }) {
  return direto ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-pine-50 px-2.5 py-0.5 text-xs font-bold text-pine-800">
      <DoorOpen aria-hidden className="size-3.5" /> Pedido direto
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-terra-50 px-2.5 py-0.5 text-xs font-bold text-terra-800">
      <Hospital aria-hidden className="size-3.5" /> Só por referenciação
    </span>
  )
}

function Nome({ r }: { r: Resposta }) {
  return (
    <span className="flex flex-col items-start gap-1.5">
      <span className="font-display text-xl leading-tight font-semibold text-ink">
        {r.nome}
        {r.sigla && <span className="ml-1.5 font-sans text-sm font-bold tracking-wide text-ink-mute">{r.sigla}</span>}
      </span>
      <Acesso direto={r.direto} />
    </span>
  )
}

const QUAL = [
  { se: 'Ainda vive em casa e quer continuar lá', entao: 'apoio domiciliário ou centro de dia' },
  { se: 'Vai ter alta e precisa de recuperar', entao: 'peça a referenciação para cuidados continuados antes da alta' },
  { se: 'Já não está em segurança em casa, mesmo com ajuda', entao: 'lar (ERPI)' },
  { se: 'É autónomo e procura companhia e serviços', entao: 'residência sénior' },
]

export function TiposSection() {
  return (
    <AnchorSection id="tipos">
      <SectionMark
        n={1}
        titleId="tipos-titulo"
        eyebrow="Tipos de resposta"
        title={
          <>
            Lar, residência, centro de dia: <em>o que é</em> cada coisa
          </>
        }
        lead="Em Portugal, «lar» é a palavra do dia a dia para a ERPI — Estrutura Residencial para Pessoas Idosas. Mas nem sempre é a primeira resposta de que a pessoa precisa."
      />

      {/* desktop: tabela comparativa */}
      <div className="mt-10 hidden overflow-hidden rounded-3xl border border-line bg-white shadow-soft md:block">
        <table className="w-full border-collapse text-left text-base">
          <caption className="sr-only">Comparação dos tipos de resposta: para quem são, custo típico e como aceder</caption>
          <thead className="bg-sand/70 text-xs tracking-[0.12em] text-ink-mute uppercase">
            <tr>
              <th scope="col" className="w-[20%] px-5 py-3 font-bold">Resposta</th>
              <th scope="col" className="px-5 py-3 font-bold">Para quem</th>
              <th scope="col" className="px-5 py-3 font-bold">Custo típico</th>
              <th scope="col" className="px-5 py-3 font-bold">Como aceder</th>
            </tr>
          </thead>
          <tbody>
            {RESPOSTAS.map((r) => (
              <tr key={r.nome} className={cn('border-t border-line align-top', !r.direto && 'bg-terra-50/40')}>
                <th scope="row" className="px-5 py-5 font-normal">
                  <Nome r={r} />
                </th>
                <td className="px-5 py-5 text-ink-soft">{r.paraQuem}</td>
                <td className="px-5 py-5 text-ink-soft">{r.custo}</td>
                <td className="px-5 py-5 text-ink-soft">
                  {r.acesso}
                  {r.pesquisa && (
                    <Link to={r.pesquisa} className="link mt-2 flex items-center gap-1 text-sm">
                      Ver no mapa <ArrowRight aria-hidden className="size-4" />
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* telemóvel: fichas empilhadas */}
      <ul className="mt-8 flex flex-col gap-4 md:hidden">
        {RESPOSTAS.map((r) => (
          <li key={r.nome} className={cn('rounded-3xl border border-line p-5', r.direto ? 'bg-white' : 'bg-terra-50/60')}>
            <Nome r={r} />
            <dl className="mt-4 flex flex-col gap-3 text-base">
              <div>
                <dt className="text-xs font-bold tracking-[0.12em] text-ink-mute uppercase">Para quem</dt>
                <dd className="mt-0.5 text-ink-soft">{r.paraQuem}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold tracking-[0.12em] text-ink-mute uppercase">Custo típico</dt>
                <dd className="mt-0.5 text-ink-soft">{r.custo}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold tracking-[0.12em] text-ink-mute uppercase">Como aceder</dt>
                <dd className="mt-0.5 text-ink-soft">{r.acesso}</dd>
              </div>
            </dl>
            {r.pesquisa && (
              <Link to={r.pesquisa} className="link mt-3 inline-flex min-h-12 items-center gap-1">
                Ver no mapa <ArrowRight aria-hidden className="size-4" />
              </Link>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <h3 className="text-2xl font-semibold text-ink">Qual faz sentido agora?</h3>
          <ul className="mt-4 flex flex-col divide-y divide-line border-y border-line">
            {QUAL.map((q) => (
              <li key={q.se} className="flex flex-col gap-1 py-3.5">
                <span className="text-ink-soft">{q.se}</span>
                <span className="flex items-center gap-2 font-bold text-pine-800">
                  <ArrowRight aria-hidden className="size-4 shrink-0 text-terra-500" /> {q.entao}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <Callout tone="atencao" title="Alta hospitalar à vista?" className="self-start">
          <p>
            Peça à equipa do hospital, <strong>antes da alta</strong>, que avalie se a pessoa pode ser referenciada para a Rede Nacional de
            Cuidados Continuados Integrados. Enquanto espera, procure em paralelo lares com vaga — as duas coisas não se excluem.
          </p>
          <p>
            <Link to="/pesquisa?vaga=agora" className="link">
              Ver lares com vaga agora
            </Link>
          </p>
        </Callout>
      </div>

      <Prose className="mt-10">
        <p>
          Nas <strong>IPSS e Misericórdias</strong> (sem fins lucrativos), parte das vagas tem acordo de cooperação com a Segurança Social e a
          mensalidade depende dos rendimentos. Nos <strong>lares privados</strong>, o preço é fixo por tipo de quarto e nível de cuidados. Em
          ambos os casos, a instituição tem de ter licença de funcionamento.
        </p>
      </Prose>
    </AnchorSection>
  )
}
