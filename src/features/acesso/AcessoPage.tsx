/**
 * /acesso — o Acesso Família (docs/MODELO-NEGOCIO.md, "modelo de dois lados").
 * Explorar é grátis e genérico; o passe de 30 ou 90 dias (sem renovação automática) mostra a camada viva:
 * que instituições têm vaga e quantos lugares, preços por quarto, previsão de espera, contactos, pedidos,
 * visitas, alertas e comparação.
 *
 * Endereço: `?voltar=` (para onde seguir depois de comprar; só caminhos internos) e `?plano=` (passe escolhido).
 * Com `?plano=`, uma conta de família sem passe encontra a folha de compra já aberta: é o regresso
 * depois de criar conta ou entrar a partir daqui.
 *
 * Esta página não mostra dados de nenhuma instituição: só os preços dos passes e uma contagem agregada.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { CircleCheck, CreditCard, Info, Landmark, Smartphone } from 'lucide-react'
import type { PlanoFamiliaId } from '@/types'
import { useAcesso, useCurrentUser } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { Reveal } from '@/components/motion'
import { FaqList } from '@/features/content/shared/Faq'
import { MoreLink, PageHero, SectionTitle } from '@/features/content/shared/ui'
import { ateExtenso, faltamTexto, maiuscula, PLANO_PADRAO, planoDoParam, tipoVisitante, voltarSeguro, type Visitante } from './compra'
import { FAQ_ACESSO } from './conteudo'
import { Equilibrado } from './texto'
import { Passes } from './Passes'
import { Comparacao } from './Comparacao'
import { CompraModal } from './CompraModal'

/** Por baixo do título: o estado do passe (família com passe) ou porque é que o passe não é para esta conta. */
function estadoVisitante(visitante: Visitante, ate: string | undefined, dias: number): ReactNode {
  if (visitante === 'familia-ativa' && ate)
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-1.5 rounded-[1.75rem] bg-sand px-6 py-6 sm:px-10">
        <p className="inline-flex items-center gap-2 text-base font-semibold text-leaf-700">
          <CircleCheck aria-hidden className="size-5" />O seu Acesso Família
        </p>
        <p className="text-xl leading-snug font-semibold text-balance text-ink sm:text-2xl">Ativo até {ateExtenso(ate)}</p>
        <p className="text-lg text-ink-mute">
          <span className="whitespace-nowrap">{maiuscula(faltamTexto(dias))}</span> · <span className="whitespace-nowrap">sem renovação automática</span>
        </p>
      </div>
    )
  if (visitante === 'profissional')
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-[1.75rem] bg-sand px-6 pt-6 pb-3 sm:px-10">
        <p className="text-xl font-semibold text-ink sm:text-2xl">Já tem acesso completo.</p>
        <p className="mt-2 text-lg text-balance text-ink-soft">
          Como profissional de saúde, vê tudo sem custos. O Acesso Família é para as famílias que procuram por conta própria.
        </p>
        <MoreLink to="/casos" tone="sand" className="text-lg">
          Os meus casos
        </MoreLink>
      </div>
    )
  if (visitante === 'lar')
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-[1.75rem] bg-sand px-6 pt-6 pb-3 sm:px-10">
        <p className="text-xl font-semibold text-ink sm:text-2xl">O Acesso Família é para famílias.</p>
        <p className="mt-2 text-lg text-balance text-ink-soft">A sua instituição gere as vagas e os pedidos no painel da instituição, sem passe.</p>
        <MoreLink to="/gestao" tone="sand" className="text-lg">
          Painel da instituição
        </MoreLink>
      </div>
    )
  return null
}

function QuemNaoPaga() {
  return (
    <section aria-labelledby="acesso-quem" className="container-page py-20 sm:py-32 lg:py-40">
      <Reveal variant="blur">
        <SectionTitle id="acesso-quem" title="Quem não paga." subtitle={<Equilibrado>O Acesso Família é para quem procura por conta própria.</Equilibrado>} />
      </Reveal>
      <div className="mx-auto mt-14 grid max-w-5xl gap-4 sm:mt-20 md:grid-cols-2">
        <Reveal className="tile flex flex-col">
          <h3 className="text-2xl font-semibold text-ink">Pessoas acompanhadas por um assistente social</h3>
          <p className="mt-3 text-lg text-ink-soft">
            Do hospital ou do centro de saúde. É o profissional que faz os pedidos, sem custos para a família.
          </p>
          <MoreLink to="/profissionais" tone="sand" className="-mb-3 pt-3 text-lg md:mt-auto">
            Para profissionais de saúde
          </MoreLink>
        </Reveal>
        <Reveal delay={120} className="tile flex flex-col">
          <h3 className="text-2xl font-semibold text-ink">Instituições</h3>
          <p className="mt-3 text-lg text-ink-soft">Lares, residências e centros de dia têm o seu próprio painel, para gerir vagas e pedidos.</p>
          <MoreLink to="/para-lares" tone="sand" className="-mb-3 pt-3 text-lg md:mt-auto">
            Para instituições
          </MoreLink>
        </Reveal>
      </div>
      <Reveal variant="fade" className="mx-auto mt-12 flex max-w-3xl flex-col items-center text-center sm:mt-16">
        <p className="text-xl leading-snug font-semibold text-balance text-ink sm:text-2xl">Pagar não muda a ordem dos resultados nem dá prioridade nas vagas.</p>
        <MoreLink to="/como-ordenamos" className="mt-1 text-lg">
          Como ordenamos
        </MoreLink>
      </Reveal>
    </section>
  )
}

const MODOS = [
  { icon: Smartphone, t: 'MB WAY', d: 'Confirma o pagamento na app, no telemóvel.' },
  { icon: Landmark, t: 'Multibanco', d: 'Com entidade e referência, no multibanco ou no homebanking.' },
  { icon: CreditCard, t: 'Cartão', d: 'De débito ou de crédito.' },
] as const

function ComoSePaga() {
  return (
    <section aria-labelledby="acesso-pagar" className="bg-sand">
      <div className="container-page py-20 sm:py-32 lg:py-40">
        <Reveal variant="blur">
          <SectionTitle
            id="acesso-pagar"
            title="Como se paga."
            subtitle={<Equilibrado>MB WAY, Multibanco ou cartão. A fatura-recibo segue por email.</Equilibrado>}
          />
        </Reveal>
        <ul className="mx-auto mt-14 grid max-w-5xl gap-4 sm:mt-20 md:grid-cols-3">
          {MODOS.map((m, i) => (
            <Reveal as="li" key={m.t} delay={i * 110} className="rounded-[1.75rem] bg-white p-7 sm:p-8">
              <m.icon aria-hidden strokeWidth={1.5} className="size-7 text-ink" />
              <h3 className="mt-5 text-2xl font-semibold text-ink">{m.t}</h3>
              <p className="mt-2 text-lg text-ink-mute">{m.d}</p>
            </Reveal>
          ))}
        </ul>
        <p className="mx-auto mt-10 flex max-w-[52ch] items-start justify-center gap-2 text-center text-lg text-ink-soft">
          <Info aria-hidden className="mt-1 size-5 shrink-0" />
          Nesta demonstração, o pagamento é simulado.
        </p>
      </div>
    </section>
  )
}

export default function AcessoPage() {
  useDocumentTitle('Acesso Família')
  const user = useCurrentUser()
  const acesso = useAcesso()
  const [params, setParams] = useSearchParams()
  const voltar = voltarSeguro(params.get('voltar'))
  const planoUrl = planoDoParam(params.get('plano'))
  const visitante = tipoVisitante(user?.role, acesso.ativo)
  const podeComprar = visitante === 'familia' || visitante === 'familia-ativa'

  // A folha abre ao escolher um passe e, logo à chegada, numa conta de família sem passe que traz ?plano=.
  // `n` monta a folha de novo a cada abertura (formulário limpo).
  const [compra, setCompra] = useState(() => ({ open: planoUrl !== null && visitante === 'familia', plano: planoUrl ?? PLANO_PADRAO, n: 0 }))

  // o ?plano= cumpre-se uma vez: sai do endereço, para que recarregar a página não volte a abrir a folha
  const abriuAChegada = useRef(compra.open)
  useEffect(() => {
    if (!abriuAChegada.current) return
    abriuAChegada.current = false
    setParams(
      (p) => {
        const q = new URLSearchParams(p)
        q.delete('plano')
        return q
      },
      { replace: true, preventScrollReset: true },
    )
  }, [setParams])

  const escolher = (plano: PlanoFamiliaId) => setCompra((c) => ({ open: true, plano, n: c.n + 1 }))

  return (
    <>
      <PageHero
        eyebrow="Acesso Família"
        title={[
          <>
            Veja <em>onde há vaga</em>,
          </>,
          'quanto custa e quanto tempo falta.',
        ]}
        subtitle={<Equilibrado>Explorar é grátis. O Acesso Família mostra a informação que muda todos os dias e põe os pedidos a andar.</Equilibrado>}
        className="max-w-[72rem]"
        titleWidth="max-w-[18ch]"
      >
        {estadoVisitante(visitante, acesso.ate, acesso.diasRestantes)}
      </PageHero>

      <Passes visitante={visitante} voltar={voltar} planoUrl={planoUrl} onEscolher={escolher} />
      <Comparacao />
      <QuemNaoPaga />
      <ComoSePaga />

      <section aria-labelledby="acesso-faq" className="container-narrow py-20 sm:py-32 lg:py-40">
        <Reveal variant="blur">
          <SectionTitle id="acesso-faq" title="Perguntas frequentes." size="md" align="left" />
        </Reveal>
        <Reveal variant="fade" delay={120}>
          <FaqList items={FAQ_ACESSO} className="mt-10" />
        </Reveal>
      </section>

      {podeComprar && (
        <CompraModal
          key={compra.n}
          open={compra.open}
          plano={compra.plano}
          onPlano={(plano) => setCompra((c) => ({ ...c, plano }))}
          onClose={() => setCompra((c) => ({ ...c, open: false }))}
          continuar={voltar ?? '/pesquisa'}
        />
      )}
    </>
  )
}
