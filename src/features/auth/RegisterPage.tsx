import { useState } from 'react'
import { useSearchParams } from 'react-router'
import type { Lar, Role } from '@/types'
import { useDocumentTitle } from '@/lib/hooks'
import { useCurrentUser, useLares } from '@/lib/store'
import { ACESSO_DESDE } from '@/components/acesso'
import { TextLink } from '@/components/ui/Button'
import { AccountSwitch } from './register/AccountSwitch'
import { FamilyForm } from './register/FamilyForm'
import { InstitutionForm } from './register/InstitutionForm'
import { ProfissionalForm } from './register/ProfissionalForm'
import { AuthShell } from './shared/AuthShell'
import { PrototypeNote } from './shared/PrototypeNote'
import { SignedInNotice } from './shared/SignedInNotice'
import { SlideSwitch } from './shared/SlideSwitch'
import { Appear, cascade } from './shared/Appear'
import { comVoltar, destinoAposEntrar, ehAcesso, intencaoDe, motivoDoDestino, precisaDeAcesso, roleDoCaminho } from './shared/redirect'

const ROLES: Role[] = ['familia', 'lar', 'profissional']
const TITULO: Record<Role, string> = { familia: 'Criar conta', lar: 'Registar instituição', profissional: 'Criar conta profissional' }

/** `?tipo=` explícito; senão, o tipo de conta da área para onde ia (ex.: `voltar=/casos/…` → profissional); senão, família. */
function tipoDe(params: URLSearchParams): Role {
  const t = params.get('tipo')
  if (ROLES.includes(t as Role)) return t as Role
  return roleDoCaminho(params.get('voltar')) ?? 'familia'
}

const DESCRICAO: Record<Role, string> = {
  familia: `Criar conta é gratuito. Explore à vontade; o Acesso Família (${ACESSO_DESDE}) mostra vagas, preços e previsão.`,
  lar: 'Publique as vagas e receba pedidos de famílias.',
  profissional: 'Para assistentes sociais: envie o mesmo pedido a várias instituições.',
}

/**
 * Família a meio de alguma coisa: o que vem depois de criar a conta, sem prometer o que é pago.
 * A caminho do Acesso Família → ativá-lo; pedir vaga, visita ou alertas → precisam do passe; guardar → é livre.
 */
function descricaoFamilia(voltar: string | null, lares: Lar[]): string | null {
  if (ehAcesso(voltar)) return 'Criar conta é gratuito. A\u00a0seguir, ativa o Acesso Família.'
  const motivo = intencaoDe(voltar) ? motivoDoDestino(voltar, lares) : null
  if (!motivo) return null
  return precisaDeAcesso(voltar)
    ? `Criar conta é gratuito. Para ${motivo}, precisa do Acesso Família (${ACESSO_DESDE}).`
    : `Criar conta é gratuito. A\u00a0seguir, pode ${motivo}.`
}

export default function RegisterPage() {
  const [params, setParams] = useSearchParams()
  const tipoUrl = tipoDe(params)
  // estado imediato (a pílula e os formulários mudam no mesmo frame do toque); o URL acompanha a seguir
  const [tipo, setTipo] = useState<Role>(tipoUrl)
  const [tipoUrlAnterior, setTipoUrlAnterior] = useState(tipoUrl)
  if (tipoUrlAnterior !== tipoUrl) {
    setTipoUrlAnterior(tipoUrl)
    setTipo(tipoUrl)
  }
  useDocumentTitle(TITULO[tipo])
  const user = useCurrentUser()
  const lares = useLares()
  const voltar = params.get('voltar')
  // a conta fica com sessão iniciada antes do visto verde no botão: manter o formulário até mudar de página
  const [aCriar, setACriar] = useState(false)

  if (user && !aCriar) return <SignedInNotice user={user} destino={destinoAposEntrar(voltar, user.role)} contexto="registar" />

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

  const entrar = comVoltar('/entrar', voltar)
  // a meio de uma ação (ex.: pedir vaga num lar) ou a caminho do Acesso Família: dizer o que vem a seguir
  const descricao = (tipo === 'familia' && descricaoFamilia(voltar, lares)) || DESCRICAO[tipo]

  return (
    <AuthShell title="Criar conta">
      <Appear delay={cascade(0)}>
        <AccountSwitch value={tipo} onChange={escolher} />
      </Appear>
      <Appear delay={cascade(1)} variant="fade">
        <p aria-live="polite" className="mt-4 mb-8 text-center text-ink-mute sm:mb-10">
          <span key={tipo} className="inline-block text-balance animate-[pop-in_.4s_cubic-bezier(.16,1,.3,1)_both] motion-reduce:animate-none">
            {descricao}
          </span>
        </p>
      </Appear>

      {/* os três formulários ficam montados: mudar de separador não apaga o que já escreveu */}
      <SlideSwitch
        active={tipo}
        panels={[
          { key: 'familia', content: <FamilyForm voltar={voltar} onPending={setACriar} /> },
          { key: 'lar', content: <InstitutionForm onPending={setACriar} /> },
          { key: 'profissional', content: <ProfissionalForm voltar={voltar} onPending={setACriar} /> },
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
