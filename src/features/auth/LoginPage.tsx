import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowDown, Building2, Info, UserRoundPlus } from 'lucide-react'
import type { Role, User } from '@/types'
import { useDocumentTitle } from '@/lib/hooks'
import { loginDemo, useCurrentUser, useLares } from '@/lib/store'
import { toast } from '@/components/ui/Toast'
import { LoginForm } from './login/LoginForm'
import { DemoAccountsPanel } from './login/DemoAccountsPanel'
import { SignedInNotice } from './shared/SignedInNotice'
import { PrototypeNote } from './shared/PrototypeNote'
import { descreverDestino, destinoAposEntrar, roleDoCaminho } from './shared/redirect'
import { pausa } from './shared/useForm'

const primeiroNome = (nome: string) => nome.split(' ')[0]

export default function LoginPage() {
  useDocumentTitle('Entrar')
  const user = useCurrentUser()
  const lares = useLares()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const voltar = params.get('voltar')
  const destinoDescrito = descreverDestino(voltar, lares)
  const roleNecessario = roleDoCaminho(voltar)
  const [loadingDemo, setLoadingDemo] = useState<Role | null>(null)
  const demoHeadingRef = useRef<HTMLHeadingElement>(null)

  const concluir = (u: User) => {
    toast.success(`Olá, ${primeiroNome(u.nome)}.`, 'Sessão iniciada.')
    navigate(destinoAposEntrar(voltar, u.role), { replace: true })
  }

  const entrarDemo = async (role: Role) => {
    if (loadingDemo) return
    setLoadingDemo(role)
    await pausa(350)
    const r = loginDemo(role)
    if (r.ok) {
      concluir(r.user)
    } else {
      setLoadingDemo(null)
      toast.error('Não foi possível entrar na conta de demonstração', 'Os dados podem ter sido alterados. Use «Repor demonstração», no rodapé, e tente de novo.')
    }
  }

  const irParaDemo = () => {
    const h = demoHeadingRef.current
    if (!h) return
    h.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
    h.focus({ preventScroll: true })
  }

  return (
    <div className="relative flex-1">
      <div className="container-page grid gap-10 py-10 sm:py-14 lg:grid-cols-12 lg:gap-14 lg:py-16">
        {/* ——— formulário ——— */}
        <div className="flex flex-col lg:col-span-5 lg:pt-4">
          <p className="eyebrow">Área pessoal</p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-ink sm:text-5xl">
            Retome onde <em>ficou</em>.
          </h1>
          <p className="mt-4 text-lg text-ink-soft">
            Os pedidos que enviou, a posição na lista de espera e os alertas de vaga ficam à sua espera. Se representa uma instituição,
            entra diretamente no painel de vagas.
          </p>

          {destinoDescrito && !user && (
            <p role="status" className="mt-6 flex items-start gap-3 rounded-2xl border border-pine-200 bg-pine-50 p-4 text-pine-900">
              <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-pine-700" />
              <span>
                Para abrir <strong>{destinoDescrito}</strong>, inicie sessão
                {roleNecessario ? ` com uma conta de ${roleNecessario === 'lar' ? 'instituição' : 'família'}` : ''}. Voltamos lá logo a seguir.
              </span>
            </p>
          )}

          <button
            type="button"
            onClick={irParaDemo}
            className="mt-6 flex min-h-12 items-center gap-3 rounded-2xl border-2 border-terra-200 bg-terra-50 px-4 py-2 text-left text-sm font-bold text-terra-800 hover:border-terra-400 lg:hidden"
          >
            <ArrowDown aria-hidden className="size-5 shrink-0" />
            Só quer experimentar? Entre com uma conta de demonstração, sem registo.
          </button>

          <div className="mt-8">
            {user ? (
              <SignedInNotice user={user} destino={destinoAposEntrar(voltar, user.role)} contexto="entrar" />
            ) : (
              <LoginForm defaultEmail={params.get('email') ?? ''} onSuccess={concluir} />
            )}
          </div>

          {!user && (
            <div className="mt-10 border-t border-line pt-8">
              <h2 className="font-display text-xl font-semibold">Ainda não tem conta?</h2>
              <ul className="mt-4 flex flex-col gap-3">
                <li>
                  <Link
                    to="/registar"
                    className="group flex min-h-14 items-center gap-4 rounded-2xl border-2 border-line bg-white px-4 py-3 transition-colors hover:border-pine-500"
                  >
                    <UserRoundPlus aria-hidden className="size-6 shrink-0 text-pine-700" />
                    <span className="flex-1">
                      <span className="block font-bold text-ink group-hover:text-pine-800">Criar conta de família</span>
                      <span className="block text-sm text-ink-soft">Gratuita. Alertas de vaga e pedidos num só lugar.</span>
                    </span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/registar?tipo=lar"
                    className="group flex min-h-14 items-center gap-4 rounded-2xl border-2 border-line bg-white px-4 py-3 transition-colors hover:border-pine-500"
                  >
                    <Building2 aria-hidden className="size-6 shrink-0 text-pine-700" />
                    <span className="flex-1">
                      <span className="block font-bold text-ink group-hover:text-pine-800">Registar uma instituição</span>
                      <span className="block text-sm text-ink-soft">Lar, residência sénior ou centro de dia.</span>
                    </span>
                  </Link>
                </li>
              </ul>
              <PrototypeNote className="mt-6" />
            </div>
          )}
        </div>

        {/* ——— contas de demonstração ——— */}
        <div className="lg:col-span-7">
          <DemoAccountsPanel ref={demoHeadingRef} user={user} loading={loadingDemo} onEnter={entrarDemo} />
        </div>
      </div>
    </div>
  )
}
