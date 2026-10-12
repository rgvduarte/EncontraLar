import { useState } from 'react'
import { useSearchParams } from 'react-router'
import type { Role } from '@/types'
import { useDocumentTitle } from '@/lib/hooks'
import { useCurrentUser } from '@/lib/store'
import { TextLink } from '@/components/ui/Button'
import { painelPath } from '@/components/layout/Header'
import { AccountSwitch } from './register/AccountSwitch'
import { FamilyForm } from './register/FamilyForm'
import { InstitutionForm } from './register/InstitutionForm'
import { AuthShell } from './shared/AuthShell'
import { PrototypeNote } from './shared/PrototypeNote'
import { SignedInNotice } from './shared/SignedInNotice'
import { SlideSwitch } from './shared/SlideSwitch'
import { Appear, cascade } from './shared/Appear'
import { isInternalPath } from './shared/redirect'

const DESCRICAO: Record<Role, string> = {
  familia: 'Gratuita. Guarde lares, peça vaga e receba alertas.',
  lar: 'Publique as vagas e receba pedidos de famílias.',
}

export default function RegisterPage() {
  const [params, setParams] = useSearchParams()
  const tipoUrl: Role = params.get('tipo') === 'lar' ? 'lar' : 'familia'
  // estado imediato (a pílula e os formulários mudam no mesmo frame do toque); o URL acompanha a seguir
  const [tipo, setTipo] = useState<Role>(tipoUrl)
  const [tipoUrlAnterior, setTipoUrlAnterior] = useState(tipoUrl)
  if (tipoUrlAnterior !== tipoUrl) {
    setTipoUrlAnterior(tipoUrl)
    setTipo(tipoUrl)
  }
  useDocumentTitle(tipo === 'lar' ? 'Registar instituição' : 'Criar conta')
  const user = useCurrentUser()
  const voltar = params.get('voltar')
  // a conta fica com sessão iniciada antes do visto verde no botão: manter o formulário até mudar de página
  const [aCriar, setACriar] = useState(false)

  if (user && !aCriar) return <SignedInNotice user={user} destino={painelPath(user.role)} contexto="registar" />

  const escolher = (r: Role) => {
    setTipo(r)
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        next.set('tipo', r)
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  }

  const entrar = isInternalPath(voltar) ? `/entrar?voltar=${encodeURIComponent(voltar)}` : '/entrar'

  return (
    <AuthShell title="Criar conta">
      <Appear delay={cascade(0)}>
        <AccountSwitch value={tipo} onChange={escolher} />
      </Appear>
      <Appear delay={cascade(1)} variant="fade">
        <p aria-live="polite" className="mt-4 mb-8 text-center text-ink-mute sm:mb-10">
          <span key={tipo} className="inline-block animate-[pop-in_.4s_cubic-bezier(.16,1,.3,1)_both] motion-reduce:animate-none">
            {DESCRICAO[tipo]}
          </span>
        </p>
      </Appear>

      {/* os dois formulários ficam montados: mudar de separador não apaga o que já escreveu */}
      <SlideSwitch
        active={tipo}
        panels={[
          { key: 'familia', content: <FamilyForm voltar={voltar} onPending={setACriar} /> },
          { key: 'lar', content: <InstitutionForm onPending={setACriar} /> },
        ]}
      />

      <Appear variant="fade" className="mt-8 flex flex-wrap items-center justify-center gap-x-1.5 text-sm text-ink-mute">
        Já tem conta?
        <TextLink to={entrar} className="min-h-12">
          Entrar
        </TextLink>
      </Appear>
      <PrototypeNote className="mt-6" />
    </AuthShell>
  )
}
