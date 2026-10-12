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
  'Os dados de saúde só seguem para as instituições a quem pede vaga, e só com o seu consentimento.',
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
          </Bloco>

          <Bloco titulo="Para quê">
            <p>
              Para sugerir instituições compatíveis, enviar os pedidos que decidir fazer e avisá-lo quando abrir uma vaga. Não vendemos dados, nem os
              usamos para publicidade.
            </p>
          </Bloco>

          <Bloco titulo="Dados de saúde">
            <p>
              São dados de <strong>categoria especial</strong> (artigo 9.º do RGPD). Só os tratamos com o seu <strong>consentimento explícito</strong>,
              que pode retirar a qualquer momento.
            </p>
            <p>
              Só os partilhamos com as <strong>instituições a quem envia um pedido de vaga</strong>, para que possam avaliar se têm condições para
              receber a pessoa. Nenhuma outra instituição os vê.
            </p>
          </Bloco>

          <Bloco titulo="Quanto tempo os guardamos">
            <p>
              Enquanto a conta estiver ativa. Se apagar a conta, apagamos o perfil e os pedidos. Os pedidos que já enviou passam também a ser tratados
              pelas instituições que os receberam, segundo as obrigações legais delas.
            </p>
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
              Nada é enviado para um servidor. Contas, perfis, pedidos e a lista da visita ficam guardados só neste navegador (no armazenamento local).
              Pode apagá-los aqui.
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
