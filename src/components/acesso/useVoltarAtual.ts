import { useLocation } from 'react-router'
import { useCurrentUser } from '@/lib/store'

/**
 * A rota atual (caminho + pesquisa, dentro do hash) para passar como `voltar` a `linkAcesso()`:
 * depois de ativar o Acesso Família, a pessoa volta ao sítio onde estava.
 */
export function useVoltarAtual(): string {
  const { pathname, search } = useLocation()
  return pathname + search
}

/** Instituições (role 'lar') veem a versão grátis, mas o convite não é para elas: sem botão, só uma nota. */
export function useEhInstituicao(): boolean {
  return useCurrentUser()?.role === 'lar'
}
