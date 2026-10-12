import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { Candidatura } from '@/types'
import { Button } from '@/components/ui/Button'
import { TextareaField } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { atualizarCandidatura } from '@/lib/store'
import type { Acao } from './acoes'

const MAX_NOTA = 400

/** Confirmação de uma mudança de estado, com nota opcional para a família. */
export function EstadoModal({ c, acao, onClose }: { c: Candidatura; acao: Acao; onClose: () => void }) {
  const [nota, setNota] = useState('')

  const confirmar = () => {
    atualizarCandidatura(c.id, acao.para, nota.trim() || undefined)
    toast.success(acao.sucesso.titulo, acao.sucesso.texto)
    onClose()
  }

  const usarSugestao = (s: string) => setNota((n) => (n.trim() ? `${n.trim()} ${s}` : s).slice(0, MAX_NOTA))

  return (
    <Modal
      open
      onClose={onClose}
      title={acao.titulo}
      description={`Pedido de ${c.contacto.nome}`}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant={acao.confirmVariant} onClick={confirmar}>
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
          label="Nota para a família"
          optional
          hint={`Aparece na notificação que ${c.contacto.nome.split(' ')[0]} recebe.`}
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
