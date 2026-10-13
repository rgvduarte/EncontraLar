import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useDocumentTitle } from '@/lib/hooks'
import { logout, resetDemo } from '@/lib/store'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Reveal } from '@/components/motion'
import { toast } from '@/components/ui/Toast'
import { ExternalLink, PageHero } from './shared/ui'

const RESUMO = [
  'Pedimos só o necessário para encontrar um lar.',
  'Os dados de saúde só seguem para as instituições a quem pede vaga, com o seu consentimento, e primeiro sem nome nem contacto.',
  'Pode ver, corrigir ou apagar tudo, quando quiser.',
] as const

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Reveal as="section" variant="fade" duration={800} className="border-t border-line py-8 sm:py-10 print:!opacity-100">
      <h2 className="text-2xl font-semibold text-ink sm:text-3xl">{titulo}</h2>
      <div className="mt-4 flex flex-col gap-4 text-lg leading-relaxed text-ink-soft [&_strong]:font-semibold [&_strong]:text-ink">{children}</div>
    </Reveal>
  )
}

/** Apaga tudo o que o protótipo guardou neste navegador e repõe os dados de demonstração. */
function apagarDadosLocais() {
  logout()
  for (const store of [localStorage, sessionStorage]) {
    try {
      Object.keys(store)
        .filter((k) => k.startsWith('encontralar:'))
        .forEach((k) => store.removeItem(k))
    } catch {
      /* armazenamento indisponível: nada a apagar */
    }
  }
  resetDemo()
}

export default function PrivacyPage() {
  useDocumentTitle('Privacidade')
  const [confirmar, setConfirmar] = useState(false)
  const navigate = useNavigate()

  const apagar = () => {
    apagarDadosLocais()
    setConfirmar(false)
    toast.success('Dados apagados', 'Terminámos a sessão e repusemos os dados de demonstração.')
    navigate('/privacidade', { replace: true })
  }

  return (
    <>
      <PageHero eyebrow="Privacidade" title="Os seus dados, com cuidado." subtitle="O que guardamos, porquê e por quanto tempo." titleWidth="max-w-[14ch]">
        <ul className="mx-auto flex max-w-[44ch] flex-col gap-2 text-left text-lg text-ink sm:text-center">
          {RESUMO.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </PageHero>

      <div className="container-narrow pb-20 sm:pb-32">
        <div className="mx-auto max-w-[44rem]">
          <Bloco titulo="Que dados tratamos">
            <p>
              <strong>Da sua conta:</strong> nome, email e, se quiser, telefone.
            </p>
            <p>
              <strong>Do perfil da pessoa de quem cuida:</strong> idade, grau de dependência, cuidados de saúde necessários, preferências, orçamento e
              zona onde procura.
            </p>
            <p>
              <strong>Da sua atividade:</strong> instituições guardadas, alertas de vaga, pedidos e visitas.
            </p>
            <p>
              <strong>Do Acesso Família, se o comprar:</strong> o passe, as datas, o método de pagamento e o valor.
            </p>
            <p>
              <strong>Da conta de um profissional de saúde:</strong> nome, email, telefone, organização e serviço, e os casos que acompanha.
            </p>
          </Bloco>

          <Bloco titulo="Para quê">
            <p>
              Para sugerir instituições compatíveis, enviar os pedidos que decidir fazer e avisar quando abrir uma vaga. Se comprar o Acesso
              Família, também para o ativar e emitir a fatura-recibo. Não vendemos dados, nem os usamos para publicidade.
            </p>
          </Bloco>

          <Bloco titulo="Pagamentos do Acesso Família">
            <p>
              Os pagamentos (MB WAY, Multibanco ou cartão) são processados pela <strong>Stripe</strong>. Os dados do cartão ou da conta bancária
              ficam com a Stripe: <strong>nunca os vemos nem os guardamos</strong>. Do pagamento, guardamos só o passe, as datas, o método e o
              valor.
            </p>
            <p>A fatura-recibo é emitida por um programa de faturação certificado pela Autoridade Tributária.</p>
          </Bloco>

          <Bloco titulo="Dados de saúde">
            <p>
              São dados de <strong>categoria especial</strong> (artigo 9.º do RGPD). Só os tratamos com o seu <strong>consentimento explícito</strong>,
              que pode retirar a qualquer momento.
            </p>
            <p>
              Só os partilhamos com as <strong>instituições a quem é enviado um pedido de vaga</strong>, por si ou pelo profissional de saúde que
              acompanha a pessoa, para que possam avaliar se têm condições para a receber. Nenhuma outra instituição os vê.
            </p>
          </Bloco>

          <Bloco titulo="Pedidos em duas fases">
            <p>
              Quando envia um pedido, a instituição vê primeiro um <strong>resumo sem identificação</strong>: faixa etária (não a idade exata), grau
              de dependência, cuidados necessários, zona, orçamento, urgência e origem do pedido (família, ou hospital com a data prevista de alta).
            </p>
            <p>
              O nome, o contacto e o perfil completo só lhe chegam se <strong>aceitar o pedido</strong>. Se recusar sem aceitar, ou se cancelar o
              pedido antes disso, nunca os vê. Na versão com servidor, esta regra é aplicada pela base de dados e não apenas no ecrã.
            </p>
          </Bloco>

          <Bloco titulo="Pedidos feitos por profissionais de saúde">
            <p>
              Assistentes sociais de hospitais, centros de saúde e autarquias podem criar um caso e enviá-lo a várias instituições. Antes de o
              criar, o profissional <strong>confirma que a pessoa, ou o seu representante, autorizou a partilha</strong> dos dados para procurar
              vaga. Sem essa confirmação, o caso não é criado nem enviado.
            </p>
            <p>
              Só o próprio profissional vê os seus casos. O contacto que as instituições recebem, depois de aceitarem, é o do profissional, e o caso
              pode ter uma referência interna que não identifica a pessoa. As duas fases aplicam-se da mesma forma.
            </p>
          </Bloco>

          <Bloco titulo="Pesquisas sem resultados">
            <p>
              Quando uma pesquisa não encontra vagas, guardamos de forma <strong>anónima</strong> o que se procurava: distrito ou localidade, grau de
              dependência, cuidados, orçamento máximo e o número de resultados. Não guardamos nome, conta, morada nem endereço IP.
            </p>
            <p>
              As instituições veem só totais do seu distrito (por exemplo, quantas procuras sem resposta houve para cuidados na demência). Estes
              registos são apagados ao fim de um ano.
            </p>
          </Bloco>

          <Bloco titulo="O link de confirmação de vagas">
            <p>
              Cada instituição pode receber, por SMS ou email, um link para confirmar as vagas num toque, sem iniciar sessão. O link mostra só o
              nome da instituição e as vagas publicadas, e só serve para responder se ainda as tem. Não dá acesso a pedidos, contactos nem dados de
              saúde.
            </p>
            <p>
              Guardamos apenas uma impressão digital do link (um hash), não o próprio link. Deixa de funcionar ao fim de 30 dias, ou quando a
              instituição pede um novo.
            </p>
          </Bloco>

          <Bloco titulo="Quanto tempo os guardamos">
            <p>
              Enquanto a conta estiver ativa. Se apagar a conta, apagamos o perfil e os pedidos. Os pedidos que já enviou passam também a ser tratados
              pelas instituições que os receberam, segundo as obrigações legais delas.
            </p>
            <p>Os registos de pagamento e as faturas ficam guardados pelo prazo que a lei fiscal exige, mesmo depois de apagar a conta.</p>
          </Bloco>

          <Bloco titulo="Os seus direitos">
            <p>
              Pode pedir acesso aos seus dados, corrigi-los, apagá-los, limitar ou opor-se ao seu tratamento, levá-los para outro serviço e retirar o
              consentimento.
            </p>
            <p>
              Se achar que os seus dados não foram bem tratados, pode apresentar queixa à Comissão Nacional de Proteção de Dados (
              <ExternalLink href="https://www.cnpd.pt">cnpd.pt</ExternalLink>).
            </p>
            <p className="text-base text-ink-mute">Na versão final, indicaremos aqui o responsável pelo tratamento e o contacto do encarregado de proteção de dados.</p>
          </Bloco>

          <Reveal variant="scale" className="mt-6 rounded-[1.75rem] bg-sand p-6 sm:p-10">
            <h2 className="text-2xl font-semibold text-ink sm:text-3xl">
              Neste protótipo
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-soft">
              Nada é enviado para um servidor. Contas, perfis, pedidos, casos, pesquisas sem resultados e a lista da visita ficam guardados só neste
              navegador (no armazenamento local). Os pagamentos do Acesso Família são simulados: nada é cobrado nem enviado à Stripe, e não há
              fatura. Os prazos de conservação e a validade do link de confirmação só se aplicam na versão com servidor. Pode apagar tudo aqui.
            </p>
            <Button variant="primary" className="mt-6 w-full py-3 whitespace-normal text-balance sm:w-auto" onClick={() => setConfirmar(true)}>
              Apagar os dados deste navegador
            </Button>
          </Reveal>
        </div>
      </div>

      <Modal
        open={confirmar}
        onClose={() => setConfirmar(false)}
        title="Apagar os dados deste navegador?"
        description="Termina a sessão e repõe os dados de demonstração. Não é possível desfazer."
        footer={
          <>
            <Button variant="subtle" onClick={() => setConfirmar(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={apagar}>
              Apagar
            </Button>
          </>
        }
      >
        <p className="text-base text-ink-soft">Perde as contas que criou, os perfis, os pedidos, as instituições guardadas e as marcações da lista da visita.</p>
      </Modal>
    </>
  )
}
