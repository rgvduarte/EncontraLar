/**
 * Acesso Família — peças partilhadas da versão grátis (docs/DESIGN.md, "Acesso Família").
 * O portão é sempre `useAcesso().completo` (@/lib/store): com false, os dados fechados NÃO vão para o DOM.
 */
export { BloqueioCartao, type BloqueioCartaoProps } from './BloqueioCartao'
export { LinhasBloqueadas, type LinhasBloqueadasProps } from './LinhasBloqueadas'
export { AvisoAcesso, type AvisoAcessoProps } from './AvisoAcesso'
export { AcessoNecessarioModal, type AcessoNecessarioModalProps } from './AcessoNecessarioModal'
export { useVoltarAtual } from './useVoltarAtual'
export {
  ACAO_ACESSO_TEXTO,
  type AcaoAcesso,
  ACESSO_CONDICOES,
  ACESSO_CTA,
  ACESSO_DESDE,
  ACESSO_DISPONIVEL,
  ACESSO_PARA_LARES,
  ACESSO_SEM_PRIORIDADE,
} from './texto'
