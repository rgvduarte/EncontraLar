import { useState } from 'react'
import { Link } from 'react-router'
import { BellRing, BookmarkCheck, Save } from 'lucide-react'
import type { User } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { savePerfil } from '@/lib/store'
import { cn } from '@/lib/cn'
import { paraPerfilInput, type Rascunho } from '../model'
import { pessoa } from '../language'
import { escreverSessao, KEY_PERFIL_RASCUNHO } from '../useMatchSession'

/** Guardar o perfil (família com sessão) ou convidar a criar conta para receber alertas de vaga. */
export function SavePanel({
  r,
  user,
  onGuardado,
  nResultados,
  className,
}: {
  r: Rascunho
  user: User | null
  onGuardado: (id: string) => void
  nResultados: number
  className?: string
}) {
  const p = pessoa(r)
  const [nome, setNome] = useState(r.nome)
  const [erro, setErro] = useState<string>()
  const [guardadoEm, setGuardadoEm] = useState<string | null>(null)
  const precisaNome = !r.nome.trim() && !p.proprio

  const base = cn('scroll-mt-28 rounded-4xl border border-line bg-white p-6 shadow-card', className)

  if (user?.role === 'lar') {
    return (
      <section id="guardar" aria-labelledby="guardar-t" className={base}>
        <h2 id="guardar-t" className="font-display text-xl font-semibold">
          Guardar perfis é para famílias
        </h2>
        <p className="mt-2 text-base text-ink-soft">
          Tem sessão iniciada com uma conta de instituição. Para guardar este perfil e receber alertas, entre com uma conta de família.
        </p>
      </section>
    )
  }

  if (!user) {
    return (
      <section id="guardar" aria-labelledby="guardar-t" className={cn(base, 'on-dark border-pine-800 bg-pine-900 text-pine-50')}>
        <BellRing aria-hidden className="size-8 text-terra-300" />
        <h2 id="guardar-t" className="mt-3 font-display text-2xl font-semibold text-white">
          Saiba quando abrir <em>vaga</em>
        </h2>
        <p className="mt-2 text-base text-pine-100">
          Guardámos estas respostas neste separador. Com uma conta gratuita, passam para o seu painel e avisamos quando abrir vaga
          {nResultados ? ` num dos ${nResultados === 1 ? 'lares sugeridos' : `${nResultados} lares sugeridos`}` : ' perto de si'}.
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <ButtonLink to="/registar" variant="accent" size="lg" full className="whitespace-normal text-center">
            Criar conta para receber alertas de vaga
          </ButtonLink>
          <Link
            to={`/entrar?voltar=${encodeURIComponent('/familia')}`}
            className="flex min-h-12 items-center justify-center rounded-2xl font-bold text-pine-100 underline decoration-pine-400 underline-offset-4 hover:text-white"
          >
            Já tenho conta
          </Link>
        </div>
      </section>
    )
  }

  const guardar = () => {
    if (precisaNome && !nome.trim()) {
      setErro('Indique o nome, para distinguir este perfil no seu painel.')
      return
    }
    const input = paraPerfilInput(r, nome)
    if (!input) return
    const perfil = savePerfil(input)
    if (!perfil) {
      toast.error('Não foi possível guardar', 'Inicie sessão novamente e tente outra vez.')
      return
    }
    escreverSessao(KEY_PERFIL_RASCUNHO, null)
    setGuardadoEm(perfil.nome)
    onGuardado(perfil.id)
    toast.success(r.id ? 'Alterações guardadas' : `Perfil de ${perfil.nome} guardado`, 'Pode vê-lo, editá-lo e fazer pedidos a partir do seu painel.')
  }

  if (guardadoEm) {
    return (
      <section id="guardar" aria-labelledby="guardar-t" className={cn(base, 'border-leaf-200 bg-leaf-50')}>
        <BookmarkCheck aria-hidden className="size-8 text-leaf-600" />
        <h2 id="guardar-t" className="mt-3 font-display text-xl font-semibold text-ink">
          Perfil de {guardadoEm} guardado
        </h2>
        <p className="mt-2 text-base text-ink-soft">Avisamos quando abrir vaga. Os pedidos aos lares usam este perfil — não precisa de repetir nada.</p>
        <ButtonLink to="/familia" variant="primary" full className="mt-5">
          Ir para o meu painel
        </ButtonLink>
      </section>
    )
  }

  return (
    <section id="guardar" aria-labelledby="guardar-t" className={base}>
      <h2 id="guardar-t" className="font-display text-2xl font-semibold text-ink">
        {r.id ? (
          <>
            Guardar as <em>alterações</em>
          </>
        ) : (
          <>
            Guardar este <em>perfil</em>
          </>
        )}
      </h2>
      <p className="mt-2 text-base text-ink-soft">
        Para receber alertas quando abrir vaga e fazer pedidos aos lares sem repetir as respostas.
      </p>
      {precisaNome && (
        <InputField
          wrapperClassName="mt-4"
          label={`Nome ${p.de}`}
          value={nome}
          onChange={(e) => {
            setNome(e.target.value)
            setErro(undefined)
          }}
          error={erro}
          autoComplete="off"
        />
      )}
      <Button variant="primary" size="lg" full className="mt-5" onClick={guardar} icon={<Save aria-hidden className="size-5" />}>
        {r.id ? 'Guardar alterações' : 'Guardar este perfil'}
      </Button>
      <p className="mt-3 text-sm text-ink-mute">Fica só na sua conta. Pode apagá-lo quando quiser.</p>
    </section>
  )
}
