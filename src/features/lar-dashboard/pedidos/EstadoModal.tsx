import { useId, useState } from 'react'
import { Info, Plus } from 'lucide-react'
import type { Candidatura } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { atualizarCandidatura } from '@/lib/store'
import type { Acao } from './acoes'

const MAX_NOTA = 400

/** Confirmação de uma mudança de estado, com nota opcional para a família. */
export function EstadoModal({ c, acao, onClose }: { c: Candidatura; acao: Acao; onClose: () => void }) {
  const [nota, setNota] = useState('')
  const id = useId()

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
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant={acao.variant === 'secondary' ? 'primary' : acao.variant} icon={<acao.icon aria-hidden className="size-5" />} onClick={confirmar}>
            {acao.confirmar}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="flex gap-3 rounded-2xl bg-pine-50 p-4 text-ink">
          <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-pine-700" />
          <span>{acao.explica}</span>
        </p>

        <div className="flex flex-col gap-2">
          <label htmlFor={id} className="font-bold">
            Nota para a família <span className="font-normal text-ink-mute">(opcional)</span>
          </label>
          <p id={`${id}-ajuda`} className="-mt-1 text-sm text-ink-soft">
            Aparece na notificação que {c.contacto.nome.split(' ')[0]} recebe. Toque numa frase para a usar.
          </p>
          {acao.sugestoes.length > 0 && (
            <ul className="flex flex-col gap-2" aria-label="Frases sugeridas">
              {acao.sugestoes.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => usarSugestao(s)}
                    className="flex min-h-12 w-full items-start gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-white px-4 py-2.5 text-left text-sm transition-colors hover:border-pine-500 hover:bg-pine-50"
                  >
                    <Plus aria-hidden className="mt-0.5 size-4 shrink-0 text-pine-700" />
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <textarea
            id={id}
            rows={4}
            maxLength={MAX_NOTA}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            aria-describedby={`${id}-ajuda ${id}-conta`}
            className="w-full rounded-2xl border-2 border-line-strong bg-white px-4 py-3 text-base leading-relaxed text-ink transition-colors hover:border-pine-400 focus:border-pine-600 focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terra-500"
            placeholder="Escreva aqui, se quiser acrescentar alguma coisa."
          />
          <p id={`${id}-conta`} className="text-right text-xs text-ink-mute tabular">
            {nota.length}/{MAX_NOTA}
          </p>
        </div>
      </div>
    </Modal>
  )
}
