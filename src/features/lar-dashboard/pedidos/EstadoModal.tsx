import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import type { Candidatura } from '@/types'
import { Button } from '@/components/ui/Button'
import { TextareaField } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { atualizarCandidatura } from '@/lib/store'
import { origemDe } from '@/lib/negocio'
import { bloqueado, encaminhadoPor, nomeContacto, pessoaAnonima } from '../shared/pedidoBits'
import type { Acao } from './acoes'

const MAX_NOTA = 400

/**
 * Confirmação de uma mudança de estado, com nota opcional para a família.
 * Fica montado enquanto fecha (open=false), para a folha descer com animação em vez de desaparecer.
 */
export function EstadoModal({ c, acao, open, onClose }: { c: Candidatura; acao: Acao; open: boolean; onClose: () => void }) {
  const [nota, setNota] = useState('')
  useEffect(() => {
    if (open) setNota('')
  }, [open, acao.id])

  const confirmar = () => {
    atualizarCandidatura(c.id, acao.para, nota.trim() || undefined)
    toast.success(acao.sucesso.titulo, acao.sucesso.texto)
    onClose()
  }

  const usarSugestao = (s: string) => setNota((n) => (n.trim() ? `${n.trim()} ${s}` : s).slice(0, MAX_NOTA))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={acao.titulo}
      description={bloqueado(c) ? `${pessoaAnonima(c)} · ${encaminhadoPor(c) ?? 'pedido de uma família'}` : `Pedido de ${nomeContacto(c)}`}
      footer={
        <>
          <Button variant="subtle" onClick={onClose} className="max-sm:min-h-13">
            Cancelar
          </Button>
          <Button variant={acao.confirmVariant} onClick={confirmar} className="max-sm:min-h-13">
            {acao.confirmar}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <p className="text-ink-soft">{acao.explica}</p>

        {acao.sugestoes.length > 0 && (
          <div>
            <p className="text-sm text-ink-mute">Frases prontas — toque para usar:</p>
            <ul className="mt-2 flex flex-col gap-2">
              {acao.sugestoes.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => usarSugestao(s)}
                    className="flex min-h-12 w-full items-start gap-2 rounded-2xl bg-sand px-4 py-3 text-left text-sm text-ink transition-colors hover:bg-sand-deep"
                  >
                    <Plus aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-mute" />
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <TextareaField
          label={origemDe(c) === 'profissional' ? 'Nota para quem encaminhou' : 'Nota para a família'}
          optional
          hint={`Aparece na notificação que ${bloqueado(c) ? 'quem fez o pedido' : nomeContacto(c).split(' ')[0]} recebe.`}
          rows={3}
          maxLength={MAX_NOTA}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Escreva aqui, se quiser acrescentar alguma coisa."
        />
        <p className="-mt-4 text-right text-xs text-ink-mute tabular">
          {nota.length}/{MAX_NOTA}
        </p>
      </div>
    </Modal>
  )
}
