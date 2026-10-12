import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { Role } from '@/types'
import { useDocumentTitle } from '@/lib/hooks'
import { useCurrentUser } from '@/lib/store'
import { painelPath } from '@/components/layout/Header'
import { azulejoBg } from '@/components/brand/patterns'
import { AccountTypePicker } from './register/AccountTypePicker'
import { FamilyForm } from './register/FamilyForm'
import { FormSection } from './register/FormSection'
import { InstitutionForm } from './register/InstitutionForm'
import { NextSteps } from './register/NextSteps'
import { RegisterAside } from './register/RegisterAside'
import type { InstitutionDraft } from './register/InstitutionPreview'
import { temRascunho } from './register/draft'
import { SignedInNotice } from './shared/SignedInNotice'

function tipoInicial(param: string | null): Role | null {
  if (param === 'lar') return 'lar'
  if (param === 'familia') return 'familia'
  // quem vem do questionário "Ajuda-me a escolher" é, quase sempre, uma família
  return temRascunho() ? 'familia' : null
}

export default function RegisterPage() {
  useDocumentTitle('Criar conta')
  const user = useCurrentUser()
  const [params, setParams] = useSearchParams()
  const tipo = tipoInicial(params.get('tipo'))
  const [draft, setDraft] = useState<InstitutionDraft | null>(null)
  const onDraftChange = useCallback((d: InstitutionDraft) => setDraft(d), [])

  const escolher = (r: Role) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        next.set('tipo', r)
        return next
      },
      { replace: true, preventScrollReset: true },
    )

  return (
    <div className="flex-1">
      <header className="relative overflow-hidden border-b border-line bg-cream">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] opacity-[0.14] [mask-image:linear-gradient(to_left,black_35%,transparent)] md:block"
          style={azulejoBg('#1d564e', 1, 72)}
        />
        <div className="container-page relative pt-10 pb-10 sm:pt-14 sm:pb-12">
          <p className="eyebrow">Criar conta</p>
          <h1 className="mt-3 max-w-4xl font-display text-4xl font-semibold text-ink sm:text-5xl lg:text-6xl">
            Menos telefonemas, <em>mais</em> respostas.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-soft">
            As famílias recebem um aviso quando abre vaga e acompanham os pedidos num só sítio. As instituições publicam as vagas e
            recebem pedidos já com o perfil de cuidados. Leva poucos minutos.
          </p>
          <p className="mt-5 text-ink-soft">
            Já tem conta?{' '}
            <Link to="/entrar" className="link">
              Entrar
            </Link>
          </p>
        </div>
      </header>

      <div className="container-page grid gap-12 py-10 sm:py-14 lg:grid-cols-12 lg:gap-14">
        <div className="min-w-0 lg:col-span-8">
          {user ? (
            <SignedInNotice user={user} destino={painelPath(user.role)} contexto="registar" />
          ) : (
            <div className="flex flex-col gap-14">
              <FormSection
                n={1}
                id="passo-tipo"
                title={
                  <>
                    Que conta <em>precisa</em>?
                  </>
                }
                intro={tipo ? undefined : 'Escolha uma das opções para ver o formulário certo.'}
              >
                <AccountTypePicker value={tipo} onChange={escolher} />
              </FormSection>

              {tipo ? (
                <div key={tipo} className="animate-fade-up">
                  {tipo === 'familia' ? <FamilyForm /> : <InstitutionForm onDraftChange={onDraftChange} />}
                </div>
              ) : (
                <NextSteps />
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-4">
          <RegisterAside tipo={user ? null : tipo} draft={tipo === 'lar' ? draft : null} />
        </div>
      </div>
    </div>
  )
}
