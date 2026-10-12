import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useBlocker } from 'react-router'
import { Modal } from './Modal'
import { Button } from './Button'

/*
 * Aviso de alterações por guardar (formulários longos: perfil de cuidados, ficha pública…).
 *
 *   useAvisoAlteracoes(sujo)
 *
 * Enquanto `sujo` for true:
 *  - sair para outra página dentro da app (pílulas, barra lateral, barra de abas, ligações) pede confirmação
 *    num diálogo "Sair sem guardar?" (mudar só a query/hash da mesma página não conta);
 *  - fechar ou recarregar o separador mostra o aviso nativo do navegador.
 *
 * Basta chamar o hook: o diálogo é desenhado pelo <AvisoAlteracoesHost/> que o Layout já monta.
 * Devolve null para poder ser usado também como `{aviso}` no JSX.
 */

interface Pendente {
  sair: () => void
  ficar: () => void
}

let pendente: Pendente | null = null
const ouvintes = new Set<() => void>()
const definir = (p: Pendente | null) => {
  pendente = p
  ouvintes.forEach((o) => o())
}
const subscrever = (o: () => void) => {
  ouvintes.add(o)
  return () => {
    ouvintes.delete(o)
  }
}

export function useAvisoAlteracoes(sujo: boolean): ReactNode {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => sujo && currentLocation.pathname !== nextLocation.pathname)

  // navegação interna bloqueada → pedir confirmação
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (!sujo) {
      blocker.proceed()
      return
    }
    // cada decisão só conta uma vez (duplo clique, Esc durante a animação de fecho…)
    let feito = false
    const p: Pendente = {
      sair: () => {
        if (feito) return
        feito = true
        definir(null)
        blocker.proceed()
      },
      ficar: () => {
        if (feito) return
        feito = true
        definir(null)
        blocker.reset()
      },
    }
    definir(p)
    return () => {
      if (pendente === p) definir(null)
    }
  }, [blocker, sujo])

  // fechar/recarregar o separador
  useEffect(() => {
    if (!sujo) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [sujo])

  return null
}

export default useAvisoAlteracoes

/** Diálogo "Sair sem guardar?" — montado uma vez no Layout. */
export function AvisoAlteracoesHost() {
  const atual = useSyncExternalStore(subscrever, () => pendente)
  // manter as ações durante a animação de fecho
  const [ultimo, setUltimo] = useState<Pendente | null>(null)
  if (atual && atual !== ultimo) setUltimo(atual)
  const acoes = atual ?? ultimo
  const ficar = () => acoes?.ficar()
  const sair = () => acoes?.sair()

  return (
    <Modal
      open={!!atual}
      onClose={ficar}
      title="Sair sem guardar?"
      footer={
        <>
          <Button variant="subtle" onClick={ficar}>
            Continuar a editar
          </Button>
          <Button variant="danger" onClick={sair}>
            Sair sem guardar
          </Button>
        </>
      }
    >
      <p className="text-ink-soft">As alterações que fez nesta página ainda não foram guardadas. Se sair agora, perdem-se.</p>
    </Modal>
  )
}
