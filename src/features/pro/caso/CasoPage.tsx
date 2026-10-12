import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { FileQuestion } from 'lucide-react'
import { useCandidaturasDoCaso } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { useScrollTo } from '@/components/motion'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/misc'
import { pessoaCurta } from '../shared/caso'
import { useCasoComPerfil } from '../shared/data'
import { MaisLink } from '../shared/ui'
import { Resumo } from './Resumo'
import { Compativeis } from './Compativeis'
import { Respostas } from './Respostas'

/**
 * Caso (/casos/:id[?lar=<id>]): resumo e ações; respostas das instituições (quando já foi enviado);
 * instituições compatíveis para enviar.
 */
export default function CasoPage() {
  const { id } = useParams()
  const { caso, perfil } = useCasoComPerfil(id)
  const cands = useCandidaturasDoCaso(caso?.id)
  const respostas = useRef<HTMLHeadingElement>(null)
  const scrollTo = useScrollTo()
  const [irRespostas, setIrRespostas] = useState(0)
  useDocumentTitle(caso && perfil ? `Caso · ${pessoaCurta(perfil)}` : 'Caso não encontrado')

  const verRespostas = useCallback(() => {
    const h = respostas.current
    if (!h) return
    h.focus({ preventScroll: true })
    scrollTo(h)
  }, [scrollTo])

  // depois de enviar: a secção "Respostas" já está desenhada com os pedidos novos
  useEffect(() => {
    if (irRespostas) verRespostas()
  }, [irRespostas, verRespostas])

  if (!caso || !perfil) {
    return (
      <EmptyState
        as="h2"
        icon={<FileQuestion />}
        title="Não encontrámos este caso"
        text="Pode ter sido criado noutra conta, ou o endereço está incompleto."
        action={<ButtonLink to="/casos">Ver os meus casos</ButtonLink>}
      />
    )
  }

  const temRespostas = cands.length > 0

  return (
    <div className="flex flex-col gap-14 sm:gap-16">
      <div className="-mt-4 flex flex-col gap-6 sm:-mt-2">
        <MaisLink to="/casos" className="self-start text-[0.9375rem] [&_svg]:order-first [&_svg]:rotate-180">
          Todos os casos
        </MaisLink>
        <Resumo caso={caso} perfil={perfil} cands={cands} onVerRespostas={verRespostas} />
      </div>
      {temRespostas && <Respostas ref={respostas} caso={caso} cands={cands} />}
      {caso.estado === 'aberto' ? (
        <Compativeis caso={caso} perfil={perfil} cands={cands} onEnviado={() => setIrRespostas((n) => n + 1)} />
      ) : (
        <p className="rounded-[1.25rem] bg-sand p-5 text-ink-soft">
          Este caso está {caso.estado === 'colocado' ? 'colocado' : 'fechado'}. Para o enviar a mais instituições, reabra-o no topo da página.
        </p>
      )}
    </div>
  )
}
