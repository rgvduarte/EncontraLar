import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { getCurrentUser, resetDemo, useCurrentUser } from '@/lib/store'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'

/**
 * "Repor dados de demonstração" com confirmação (rodapé, página da conta…).
 *
 *   const repor = useReporDemo()
 *   <button onClick={repor.pedir}>Repor dados de demonstração</button>
 *   {repor.modal}
 *
 * Se a conta com sessão não fizer parte do exemplo, é apagada: primeiro sai-se para o início
 * (para a página protegida não mandar para /entrar) e só depois se repõem os dados.
 */
export function useReporDemo(): { pedir: () => void; modal: ReactNode } {
  const [aberto, setAberto] = useState(false)
  const user = useCurrentUser()
  const navigate = useNavigate()

  const confirmar = async () => {
    setAberto(false)
    const atual = getCurrentUser()
    const contaApagada = Boolean(atual && !atual.demo)
    if (contaApagada) await navigate('/', { replace: true, flushSync: true })
    resetDemo()
    // confirmar com os dados novos (a conta pode ter sido apagada mesmo sendo de exemplo, se o seed mudou)
    const ficou = atual ? getCurrentUser()?.id === atual.id : true
    if (!ficou) {
      if (!contaApagada) navigate('/', { replace: true })
      toast.info('Dados de demonstração repostos', 'A sua conta não fazia parte do exemplo e foi removida.')
    } else {
      toast.success('Dados de demonstração repostos')
    }
  }

  const modal = (
    <Modal
      open={aberto}
      onClose={() => setAberto(false)}
      title="Repor os dados de demonstração?"
      description="Afeta apenas este navegador. Não é possível desfazer."
      footer={
        <>
          <Button variant="subtle" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => void confirmar()}>
            Repor
          </Button>
        </>
      }
    >
      <p className="text-ink-soft">
        Apaga as contas, perfis e pedidos criados neste navegador e volta ao exemplo inicial, incluindo o painel das instituições.
      </p>
      {user && !user.demo && (
        <p className="mt-3 text-ink-soft">
          A sua conta (<span className="font-medium text-ink">{user.email}</span>) não faz parte do exemplo: será apagada e a sessão termina.
        </p>
      )}
    </Modal>
  )

  return { pedir: () => setAberto(true), modal }
}
