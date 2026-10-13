import { Button, ButtonLink } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PLANOS_FAMILIA, linkAcesso, precoTexto } from '@/lib/acesso'
import { cn } from '@/lib/cn'
import { ACAO_ACESSO_TEXTO, ACESSO_CONDICOES, ACESSO_CTA, ACESSO_DISPONIVEL, ACESSO_PARA_LARES, ACESSO_SEM_PRIORIDADE, type AcaoAcesso } from './texto'
import { useEhInstituicao, useVoltarAtual } from './useVoltarAtual'

export interface AcessoNecessarioModalProps {
  open: boolean
  onClose: () => void
  acao: AcaoAcesso
  /** para onde voltar depois de ativar (por omissão, a rota atual) */
  voltar?: string
}

/**
 * Folha (telemóvel) ou diálogo (desktop) quando alguém na versão grátis tenta uma ação paga: diz para que serve,
 * mostra os dois passes com o preço (o recomendado em destaque) e leva à página do Acesso Família, com o passe
 * de 90 dias escolhido. "Agora não" fecha, sem insistir.
 */
export function AcessoNecessarioModal({ open, onClose, acao, voltar }: AcessoNecessarioModalProps) {
  const atual = useVoltarAtual()
  const instituicao = useEhInstituicao()
  const base = linkAcesso(voltar ?? atual)
  const destino = `${base}${base.includes('?') ? '&' : '?'}plano=acesso_90`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={ACESSO_DISPONIVEL}
      description={ACAO_ACESSO_TEXTO[acao]}
      footer={
        instituicao ? (
          <Button variant="subtle" onClick={onClose}>
            Fechar
          </Button>
        ) : (
          <>
            <Button variant="subtle" onClick={onClose}>
              Agora não
            </Button>
            <ButtonLink to={destino} onClick={onClose} variant="primary">
              {ACESSO_CTA}
            </ButtonLink>
          </>
        )
      }
    >
      <ul className="grid grid-cols-2 gap-3">
        {PLANOS_FAMILIA.map((p) => (
          <li
            key={p.id}
            className={cn('flex flex-col rounded-3xl p-4 sm:p-5', p.destaque ? 'bg-white ring-2 ring-terra-600' : 'bg-sand')}
          >
            <p className="flex flex-wrap items-baseline justify-between gap-x-2 font-semibold text-ink">
              {p.nome}
              {p.destaque && <span className="text-xs font-semibold text-terra-700">Recomendado</span>}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-ink tabular">{precoTexto(p.precoCentimos)}</p>
            <p className="mt-2 text-sm text-ink-mute">{p.resumo}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-ink-mute">{instituicao ? ACESSO_PARA_LARES : ACESSO_CONDICOES}</p>
      <p className="mt-1 text-sm text-ink-mute">{ACESSO_SEM_PRIORIDADE}</p>
    </Modal>
  )
}
