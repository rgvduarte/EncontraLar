import { useId, useRef, useState } from 'react'
import type { Caso, PerfilIdoso } from '@/types'
import { atualizarCaso, useLares } from '@/lib/store'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { CamposCaso, focarCampo } from '../form/CamposCaso'
import { casoParaForm, mesmoCaso, ORDEM_CAMPOS, perfilDoForm, validarCaso, type CasoForm, type ErrosCaso } from '../form/casoModel'

/** Folha de edição do caso (folha inferior no telemóvel): perfil de cuidados, alta prevista e referência. */
export function EditarCaso({ open, onClose, caso, perfil }: { open: boolean; onClose: () => void; caso: Caso; perfil: PerfilIdoso }) {
  const lares = useLares()
  const formId = useId()
  const raiz = useRef<HTMLFormElement>(null)
  const [inicial, setInicial] = useState<CasoForm>(() => casoParaForm(caso, perfil))
  const [form, setForm] = useState<CasoForm>(inicial)
  const [erros, setErros] = useState<ErrosCaso>({})
  // cada vez que abre, começa com os dados atuais do caso
  const [aberto, setAberto] = useState(open)
  if (open !== aberto) {
    setAberto(open)
    if (open) {
      const f = casoParaForm(caso, perfil)
      setInicial(f)
      setForm(f)
      setErros({})
    }
  }
  const sujo = !mesmoCaso(form, inicial)

  const set = <K extends keyof CasoForm>(k: K, v: CasoForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (k in erros) setErros((e) => ({ ...e, [k]: undefined }))
  }

  const guardar = () => {
    const v = validarCaso(form, { novo: false, altaInicial: inicial.altaPrevista })
    setErros(v)
    const campo = ORDEM_CAMPOS.find((c) => v[c])
    if (campo) {
      toast.error('Falta corrigir o caso', v[campo])
      if (raiz.current) focarCampo(campo, raiz.current)
      return
    }
    atualizarCaso(caso.id, {
      referencia: form.referencia.trim() || undefined,
      altaPrevista: form.altaPrevista || undefined,
      perfil: perfilDoForm(form, perfil),
    })
    toast.success('Caso atualizado', 'Os pedidos já enviados mantêm a versão que as instituições receberam.')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Editar caso"
      description="Os pedidos já enviados não mudam: cada instituição mantém a versão que recebeu."
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={!sujo}>
            {sujo ? 'Guardar alterações' : 'Sem alterações'}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        ref={raiz}
        noValidate
        aria-label="Editar caso"
        onSubmit={(e) => {
          e.preventDefault()
          guardar()
        }}
        className="pb-4"
      >
        <CamposCaso form={form} set={set} erros={erros} lares={lares} novo={false} />
      </form>
    </Modal>
  )
}
