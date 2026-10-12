import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { User } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { savePerfil } from '@/lib/store'
import { cn } from '@/lib/cn'
import { paraPerfilInput, type Rascunho } from '../model'
import { pessoa } from '../language'
import { escreverSessao, KEY_PERFIL_RASCUNHO } from '../useMatchSession'

/**
 * Guardar o perfil (família com sessão) ou convidar a criar conta para receber alertas de vaga.
 * Sem sessão, o rascunho já está no sessionStorage (ResultsView) — o painel oferece-se para o guardar depois.
 */
export function SavePanel({
  r,
  user,
  onGuardado,
  className,
}: {
  r: Rascunho
  user: User | null
  onGuardado: (id: string) => void
  className?: string
}) {
  const p = pessoa(r)
  const [nome, setNome] = useState(r.nome)
  const [erro, setErro] = useState<string>()
  const [guardado, setGuardado] = useState<string | null>(null)
  const precisaNome = !r.nome.trim() && !p.proprio

  if (user?.role === 'lar') {
    return (
      <section id="guardar" aria-labelledby="guardar-t" className={cn('tile scroll-mt-24 text-center', className)}>
        <h2 id="guardar-t" className="text-2xl font-semibold text-ink">
          Guardar perfis é para famílias
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-lg text-ink-mute">
          Tem sessão iniciada com uma conta de instituição. Para guardar este perfil e receber alertas, entre com uma conta de família.
        </p>
      </section>
    )
  }

  if (!user) {
    return (
      <section
        id="guardar"
        aria-labelledby="guardar-t"
        className={cn('on-dark scroll-mt-24 rounded-[1.75rem] bg-ink px-6 py-14 text-center text-white sm:px-12 sm:py-20', className)}
      >
        <h2 id="guardar-t" className="mx-auto max-w-2xl text-4xl font-semibold text-white sm:text-5xl">
          Saiba quando abrir <em>vaga</em>.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-white/70 sm:text-xl">
          Com uma conta gratuita, estas respostas passam para o seu painel e avisamos quando houver lugar.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <ButtonLink to="/registar" variant="accent" size="lg" className="max-w-full whitespace-normal! text-center">
            Criar conta para receber alertas
          </ButtonLink>
          <Link
            to={`/entrar?voltar=${encodeURIComponent('/familia')}`}
            className="inline-flex min-h-12 items-center gap-0.5 rounded-full px-3 text-lg font-medium text-terra-300 hover:underline"
          >
            Já tenho conta
            <ChevronRight aria-hidden className="size-5" />
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
    const input = paraPerfilInput(r, p.proprio && !r.nome.trim() ? user.nome : nome)
    if (!input) return
    const perfil = savePerfil(input)
    if (!perfil) {
      toast.error('Não foi possível guardar', 'Inicie sessão novamente e tente outra vez.')
      return
    }
    escreverSessao(KEY_PERFIL_RASCUNHO, null)
    setGuardado(perfil.nome)
    onGuardado(perfil.id)
    toast.success(r.id ? 'Alterações guardadas' : `Perfil de ${perfil.nome} guardado`, 'Avisamos quando abrir vaga.')
  }

  if (guardado) {
    return (
      <section id="guardar" aria-labelledby="guardar-t" className={cn('tile scroll-mt-24 text-center', className)}>
        <h2 id="guardar-t" className="text-3xl font-semibold text-ink sm:text-4xl">
          Perfil de {guardado} guardado.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-lg text-ink-mute">
          Avisamos quando abrir vaga. Os pedidos aos lares usam este perfil, sem repetir nada.
        </p>
        <ButtonLink to="/familia" size="lg" className="mt-8" iconRight={<ChevronRight aria-hidden />}>
          Ir para o meu painel
        </ButtonLink>
      </section>
    )
  }

  return (
    <section id="guardar" aria-labelledby="guardar-t" className={cn('tile scroll-mt-24 text-center', className)}>
      <h2 id="guardar-t" className="text-3xl font-semibold text-ink sm:text-4xl">
        {r.id ? 'Guardar as alterações' : 'Guardar este perfil'}
      </h2>
      <p className="mx-auto mt-4 max-w-lg text-lg text-ink-mute">Para receber alertas de vaga e fazer pedidos sem repetir respostas.</p>
      <div className="mx-auto mt-8 flex max-w-md flex-col items-stretch gap-4 text-left">
        {precisaNome && (
          <InputField
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
        <Button size="lg" onClick={guardar} className="self-center px-10">
          {r.id ? 'Guardar alterações' : 'Guardar perfil'}
        </Button>
      </div>
      <p className="mt-4 text-sm text-ink-mute">Fica só na sua conta. Pode apagá-lo quando quiser.</p>
    </section>
  )
}
