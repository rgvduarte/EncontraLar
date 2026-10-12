import { Mail, Phone, UserRound } from 'lucide-react'
import type { Candidatura } from '@/types'
import { ButtonLink, Button, buttonClasses } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ESTADO_CANDIDATURA_LABEL } from '@/lib/labels'
import { telHref } from '../shared/pedidoBits'
import type { Acao } from './acoes'

/**
 * Folha de ações (telemóvel): tudo o que se pode fazer com um pedido, em botões largos ao alcance do polegar —
 * como a folha de ações do iOS. Abre a partir do botão "⋯" de cada linha.
 */
export function AcoesFolha({
  open,
  onClose,
  c,
  acoes,
  verHref,
  onEscolher,
}: {
  open: boolean
  onClose: () => void
  c: Candidatura
  acoes: Acao[]
  verHref?: string
  onEscolher: (a: Acao) => void
}) {
  const primeiro = c.contacto.nome.split(' ')[0]
  const bloqueada = acoes.find((a) => a.bloqueio)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${c.perfil.nome}, ${c.perfil.idade} anos`}
      description={`${ESTADO_CANDIDATURA_LABEL[c.estado]} · pedido de ${c.contacto.nome}`}
      footer={
        <Button variant="subtle" size="lg" onClick={onClose}>
          Cancelar
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {acoes.map((a) => (
          <Button key={a.id} size="lg" full variant={a.variant} disabled={Boolean(a.bloqueio)} onClick={() => onEscolher(a)}>
            {a.label}
          </Button>
        ))}
        {bloqueada && <p className="text-sm text-ink-mute">{bloqueada.bloqueio}</p>}

        <div aria-hidden className="my-1 h-px bg-line" />

        {c.contacto.telefone && (
          <a href={telHref(c.contacto.telefone)} className={buttonClasses('secondary', 'lg', 'w-full')}>
            <Phone aria-hidden strokeWidth={1.75} />
            Ligar a {primeiro}
            <span className="sr-only"> ({c.contacto.telefone})</span>
          </a>
        )}
        <a
          href={`mailto:${c.contacto.email}?subject=${encodeURIComponent(`Pedido de vaga — ${c.perfil.nome}`)}`}
          className={buttonClasses('secondary', 'lg', 'w-full')}
        >
          <Mail aria-hidden strokeWidth={1.75} />
          Escrever a {primeiro}
        </a>
        {verHref && (
          <ButtonLink to={verHref} variant="ghost" size="lg" full icon={<UserRound aria-hidden strokeWidth={1.75} />} onClick={onClose}>
            Perfil completo e histórico
          </ButtonLink>
        )}
      </div>
    </Modal>
  )
}
