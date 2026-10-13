import { useEffect, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { User } from '@/types'
import { useAcesso } from '@/lib/store'
import { Button, ButtonLink } from '@/components/ui/Button'
import { useLenis } from '@/components/motion'
import { subscribeScroll } from '@/lib/motion'
import { plural } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Rascunho } from '../model'
import { scrollAte } from '../motion'
import { useGuardarPerfil } from './useGuardarPerfil'

/**
 * Barra "Guardar perfil" sempre à mão enquanto se percorre a lista (como a barra de compra das páginas da Apple):
 * aparece depois do resumo, esconde-se quando o painel "Guardar este perfil" chega ao ecrã (nunca tapa o rodapé).
 * Telemóvel: barra no fundo, acima da área segura (/encontrar não tem barra de abas). Desktop: pílula flutuante.
 * Fixa → renderizada num portal no <body> (a transição de página usa transform, que prenderia o `fixed`).
 */
export function SaveBar({
  r,
  user,
  n,
  onGuardado,
  depoisDe,
}: {
  r: Rascunho
  user: User | null
  /** nº de sugestões compatíveis */
  n: number
  onGuardado: (id: string) => void
  /** a barra só aparece depois de este bloco sair do ecrã */
  depoisDe: RefObject<HTMLElement | null>
}) {
  const lenis = useLenis()
  const { p, precisaNome, nomePorOmissao, semAlteracoes, guardar } = useGuardarPerfil(r, user, onGuardado)
  const [noSitio, setNoSitio] = useState(false)
  // alertas de vaga só com o Acesso Família (visitantes e famílias sem passe: guardar as respostas)
  const { completo } = useAcesso()

  useEffect(
    () =>
      subscribeScroll(() => {
        const antes = depoisDe.current
        if (!antes) return
        const painel = document.getElementById('guardar')
        const passou = antes.getBoundingClientRect().bottom < 64
        const chegou = painel ? painel.getBoundingClientRect().top < window.innerHeight - 24 : false
        const v = passou && !chegou
        setNoSitio((a) => (a === v ? a : v))
      }),
    [depoisDe],
  )

  if (user?.role === 'lar') return null
  const disponivel = !(user && semAlteracoes)
  const visivel = disponivel && noSitio

  // curto: tem de caber ao lado do botão a 390px
  const titulo = user
    ? p.proprio
      ? 'O seu perfil'
      : p.primeiroNome
        ? `Perfil de ${p.primeiroNome}`
        : `Perfil ${p.de}`
    : 'Guardar as respostas'
  const sub = user ? (r.id ? 'Alterações por guardar' : completo ? 'Para receber alertas' : 'Fica no seu painel') : 'Conta gratuita'

  const aoGuardar = () => {
    if (!precisaNome) {
      guardar(nomePorOmissao)
      return
    }
    // falta o nome: leva ao painel e põe o cursor no campo (foco ainda dentro do toque → o teclado abre no iOS)
    const painel = document.getElementById('guardar')
    if (!painel) return
    painel.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
    scrollAte(lenis, painel, 'center')
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[900] flex justify-center lg:bottom-6 lg:px-6">
      <div
        inert={!visivel}
        // enquanto visível, conta como "fundo" para o scroll programático (painéis que abrem, campos focados)
        data-match-barra={visivel ? '' : undefined}
        className={cn(
          'flex w-full items-center gap-3 border-t border-black/[0.06] bg-white/85 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl backdrop-saturate-150',
          'lg:w-auto lg:min-w-[32rem] lg:gap-6 lg:rounded-full lg:border-0 lg:py-2.5 lg:pr-2.5 lg:pl-7 lg:shadow-lift lg:ring-1 lg:ring-black/[0.06]',
          'transition-[translate,opacity] duration-500 ease-[cubic-bezier(.16,1,.3,1)]',
          visivel ? 'pointer-events-auto translate-y-0 opacity-100' : 'translate-y-full opacity-0 lg:translate-y-6',
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-base leading-tight font-semibold text-ink">{titulo}</p>
          <p className="truncate text-sm leading-snug text-ink-mute">
            {sub}
            {n > 0 && <span className="max-sm:hidden"> · {plural(n, 'sugestão compatível', 'sugestões compatíveis')}</span>}
          </p>
        </div>
        {user ? (
          <Button size="lg" onClick={aoGuardar} className="shrink-0 px-6 max-lg:min-h-13 lg:px-7">
            {r.id ? 'Guardar' : 'Guardar perfil'}
          </Button>
        ) : (
          <ButtonLink
            to="/registar"
            variant="accent"
            size="lg"
            className="shrink-0 px-6 max-lg:min-h-13 lg:px-7"
          >
            Criar conta
          </ButtonLink>
        )}
      </div>
    </div>,
    document.body,
  )
}
