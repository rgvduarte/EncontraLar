/**
 * #tipos — as respostas para pessoas idosas em Portugal, comparadas numa tabela limpa.
 */
import { Reveal } from '@/components/motion'
import { cn } from '@/lib/cn'
import { MoreLink } from '../shared/ui'
import { GuideSection, REVEAL_PRINT } from './Section'

interface Resposta {
  nome: string
  sigla?: string
  paraQuem: string
  custo: string
  acesso: string
  /** só por referenciação (não se pede diretamente) */
  referenciacao?: boolean
}

const RESPOSTAS: Resposta[] = [
  {
    nome: 'Lar',
    sigla: 'ERPI',
    paraQuem: 'Quem já não está em segurança em casa, mesmo com ajuda.',
    custo: 'IPSS e Misericórdias: conforme os rendimentos. Privados: preço fixo.',
    acesso: 'Pedido direto a cada lar. Pode inscrever-se em vários.',
  },
  {
    nome: 'Residência sénior',
    paraQuem: 'Pessoas autónomas que querem companhia, segurança e serviços.',
    custo: 'Quase sempre privada, com preço fixo. Costuma ser a mais cara.',
    acesso: 'Contacto direto com a residência.',
  },
  {
    nome: 'Centro de dia',
    paraQuem: 'Quem vive em casa, mas precisa de companhia e refeições durante o dia.',
    custo: 'Nas IPSS, conforme os rendimentos. Em geral, a resposta mais acessível.',
    acesso: 'Pedido direto à instituição.',
  },
  {
    nome: 'Apoio domiciliário',
    sigla: 'SAD',
    paraQuem: 'Quem quer ficar em casa, com ajuda na higiene, nas refeições ou na medicação.',
    custo: 'Nas IPSS, conforme os rendimentos e os serviços escolhidos.',
    acesso: 'Pedido direto à instituição que serve a sua zona.',
  },
  {
    nome: 'Cuidados continuados',
    sigla: 'RNCCI',
    paraQuem: 'Quem precisa de recuperar depois de um internamento, por exemplo após um AVC ou uma fratura.',
    custo: 'Convalescença sem custos. Média e longa duração: a parte social é paga conforme os rendimentos.',
    acesso: 'Só por referenciação do hospital ou do centro de saúde.',
    referenciacao: true,
  },
]

function Nome({ r }: { r: Resposta }) {
  return (
    <>
      <span className="block font-semibold text-ink">{r.nome}</span>
      {r.sigla && <span className="block text-sm text-ink-mute">{r.sigla}</span>}
    </>
  )
}

export function Tipos() {
  return (
    <GuideSection
      id="tipos"
      title="O que é cada resposta."
      lead="«Lar» é a palavra do dia a dia para a ERPI, a Estrutura Residencial para Pessoas Idosas. Mas nem sempre é a primeira resposta de que a pessoa precisa."
    >
      {/* desktop: tabela */}
      <table className="hidden w-full border-collapse text-left text-base leading-relaxed md:table">
        <caption className="sr-only">Tipos de resposta: para quem são, quanto custam e como se pede</caption>
        <thead>
          <tr className="text-sm text-ink-mute">
            <th scope="col" className="w-[19%] pr-6 pb-3 font-medium">
              Resposta
            </th>
            <th scope="col" className="w-[29%] pr-6 pb-3 font-medium">
              Para quem
            </th>
            <th scope="col" className="w-[29%] pr-6 pb-3 font-medium">
              Custo
            </th>
            <th scope="col" className="pb-3 font-medium">
              Como se pede
            </th>
          </tr>
        </thead>
        <tbody>
          {RESPOSTAS.map((r) => (
            <tr key={r.nome} className="border-t border-line align-top">
              <th scope="row" className="py-5 pr-6 font-normal">
                <Nome r={r} />
              </th>
              <td className="py-5 pr-6 text-ink-soft">{r.paraQuem}</td>
              <td className="py-5 pr-6 text-ink-soft">{r.custo}</td>
              <td className={r.referenciacao ? 'py-5 font-medium text-ink' : 'py-5 text-ink-soft'}>{r.acesso}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* telemóvel: a tabela passa a cartões empilhados (um por resposta) */}
      <ul className="flex flex-col gap-3 md:hidden">
        {RESPOSTAS.map((r, i) => (
          <Reveal as="li" key={r.nome} variant="fade" delay={i * 60} className={cn('rounded-[1.5rem] bg-sand p-5', REVEAL_PRINT)}>
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-xl font-semibold text-ink">{r.nome}</span>
              {r.sigla && <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-sm font-medium text-ink-soft">{r.sigla}</span>}
            </p>
            <dl className="mt-3 flex flex-col divide-y divide-line-strong/60 text-base">
              <div className="py-2.5">
                <dt className="text-sm text-ink-mute">Para quem</dt>
                <dd className="text-ink">{r.paraQuem}</dd>
              </div>
              <div className="py-2.5">
                <dt className="text-sm text-ink-mute">Custo</dt>
                <dd className="text-ink-soft">{r.custo}</dd>
              </div>
              <div className="pt-2.5">
                <dt className="text-sm text-ink-mute">Como se pede</dt>
                <dd className={r.referenciacao ? 'font-semibold text-ink' : 'text-ink-soft'}>{r.acesso}</dd>
              </div>
            </dl>
          </Reveal>
        ))}
      </ul>

      <div className="mt-8 rounded-[1.75rem] bg-sand p-6 ring-1 ring-line-strong/60 ring-inset sm:p-8 md:ring-0">
        <p className="text-lg font-semibold text-ink">Alta hospitalar à vista?</p>
        <p className="mt-2 text-lg leading-relaxed text-ink-soft">
          Peça à equipa do hospital, antes da alta, que avalie a referenciação para cuidados continuados. Em paralelo, procure lar com vaga: uma
          coisa não exclui a outra.
        </p>
        <MoreLink to="/pesquisa?vaga=agora" tone="sand" className="mt-2">
          Lares com vaga agora
        </MoreLink>
      </div>
    </GuideSection>
  )
}
