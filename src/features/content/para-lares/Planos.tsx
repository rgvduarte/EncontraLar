/**
 * "Quanto custa" — o modelo de negócio, sem valores (docs/MODELO-NEGOCIO.md):
 * estar no EncontraLar é gratuito para todas as instituições, com todas as funcionalidades;
 * os lares privados pagam só uma taxa fixa por cada pessoa que entra através da plataforma
 * (valor acordado no contrato, nunca publicado); IPSS e Misericórdias não pagam nada;
 * grupos com várias casas falam connosco. Ninguém paga para aparecer primeiro: nem as instituições,
 * nem as famílias que compram o Acesso Família para ver as vagas em tempo real.
 */
import { Check } from 'lucide-react'
import type { Lar } from '@/types'
import { euro } from '@/lib/format'
import { QUARTO_LABEL } from '@/lib/labels'
import { maiuscula, noLar } from '@/lib/artigos'
import { Reveal } from '@/components/motion'
import { MoreLink, SectionTitle } from '../shared/ui'

const INCLUIDO = [
  'Ficha verificada',
  'Vagas em tempo real no mapa',
  'Lista de espera digital',
  'Pedidos com perfil de cuidados',
  'Encaminhamentos de hospitais e centros de saúde',
  'Previsão de vagas',
] as const

const QUEM: { quem: string; condicao: string; nota?: string; contacto?: boolean }[] = [
  {
    quem: 'Lares privados',
    condicao: 'Uma taxa fixa por cada pessoa que entra através do EncontraLar.',
    nota: 'Sem mensalidade, sem percentagem sobre a mensalidade, sem custos de adesão. O valor é acordado no contrato.',
  },
  { quem: 'IPSS e Misericórdias', condicao: 'Sem qualquer taxa.', nota: 'Nem por pedidos, nem por entradas.' },
  { quem: 'Grupos e redes com várias casas', condicao: 'Condições sob consulta.', contacto: true },
]

/**
 * O custo de um lugar por preencher, no lar de exemplo. Conta um lugar (a mensalidade é por pessoa):
 * num quarto duplo vazio seriam dois. Não se compara com nenhum valor do EncontraLar.
 */
function LugarVazio({ lar }: { lar: Lar }) {
  const q = [...lar.quartos].sort((a, b) => a.precoMin - b.precoMin)[0]
  if (!q || q.precoMin <= 0) return null
  const semana = (q.precoMin / 30) * 7
  const quarto = q.tipo === 'individual' ? '' : ` em ${QUARTO_LABEL[q.tipo].replace(' (partilhado)', '').toLowerCase()}`
  return (
    <p className="mx-auto mt-12 max-w-[52ch] text-center text-lg text-ink-mute sm:mt-16">
      {maiuscula(noLar(lar.nome))}, uma semana com um lugar vazio{quarto} custa cerca de{' '}
      <span className="font-semibold text-ink tabular">{euro(semana)}</span>. É por isso que só cobramos quando alguém entra.
    </p>
  )
}

export function QuantoCusta({ lar }: { lar: Lar }) {
  return (
    <section id="quanto-custa" aria-labelledby="pl-custo" className="container-page scroll-mt-16 py-20 outline-none sm:py-32 lg:py-40">
      <Reveal variant="blur" className="flex flex-col items-center">
        <p className="eyebrow mb-4">Quanto custa</p>
        <SectionTitle
          id="pl-custo"
          title={
            <>
              Estar no EncontraLar é <em>gratuito</em>.
            </>
          }
          subtitle="Para todas as instituições, com todas as funcionalidades."
        />
      </Reveal>

      <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:mt-20 lg:grid-cols-12">
        <Reveal className="flex flex-col rounded-[1.75rem] bg-sand p-6 sm:p-10 lg:col-span-5">
          <h3 className="text-2xl font-semibold text-ink sm:text-3xl">Incluído, para todas.</h3>
          <ul className="mt-6 flex flex-col gap-3">
            {INCLUIDO.map((f) => (
              <li key={f} className="flex gap-3 text-lg text-ink">
                <Check aria-hidden strokeWidth={2} className="mt-1.5 size-4 shrink-0 text-ink-mute" />
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-base text-ink-mute lg:mt-auto lg:pt-8">Para as instituições, não há planos nem funcionalidades pagas.</p>
        </Reveal>

        <Reveal delay={120} className="rounded-[1.75rem] bg-white px-6 ring-1 ring-line ring-inset sm:px-10 lg:col-span-7">
          <h3 className="sr-only">Quem paga o quê</h3>
          <dl className="divide-y divide-line">
            {QUEM.map((q) => (
              <div key={q.quem} className="py-6 sm:py-8">
                <dt className="text-base font-medium text-ink-mute">{q.quem}</dt>
                <dd className="mt-1">
                  <p className="text-xl leading-snug font-semibold text-ink sm:text-2xl">{q.condicao}</p>
                  {q.nota && <p className="mt-2 text-base text-ink-mute">{q.nota}</p>}
                  {q.contacto && (
                    <MoreLink to="/registar?tipo=lar&plano=rede" className="-mb-3 text-lg">
                      Falar connosco
                    </MoreLink>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>

      <Reveal variant="fade" delay={150}>
        <LugarVazio lar={lar} />
      </Reveal>

      <Reveal variant="fade" className="mx-auto mt-16 flex max-w-[48ch] flex-col items-center text-center sm:mt-24">
        <h3 className="text-2xl font-semibold text-ink sm:text-3xl">Ninguém paga para aparecer primeiro.</h3>
        <p className="mt-3 text-lg text-ink-mute">
          Não há posições pagas nem destaques à venda. A taxa não muda a ordem dos resultados, e o selo de verificação não se compra. As
          famílias podem pagar um Acesso Família para ver as vagas em tempo real, mas isso nunca muda a ordem nem dá prioridade nas vagas.
        </p>
        <MoreLink to="/como-ordenamos" className="mt-1 text-lg">
          Como ordenamos
        </MoreLink>
      </Reveal>
    </section>
  )
}
