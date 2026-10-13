import { useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { User } from '@/types'
import { Button, ButtonLink, TextLink } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { useAcesso } from '@/lib/store'
import { cn } from '@/lib/cn'
import type { Rascunho } from '../model'
import { primeiroNome, useGuardarPerfil } from './useGuardarPerfil'

/**
 * Guardar o perfil (família com sessão) ou convidar a criar conta para o guardar (os alertas de vaga são do
 * Acesso Família: sem passe, o painel não os promete).
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
  const {
    p,
    precisaNome,
    existente,
    nomePorOmissao,
    semAlteracoes,
    guardar: guardarPerfil,
  } = useGuardarPerfil(r, user, onGuardado)
  const nomeRef = useRef<HTMLInputElement>(null)
  const [nome, setNome] = useState(r.nome)
  const [erro, setErro] = useState<string>()
  const [guardado, setGuardado] = useState<{ nome: string; alterado: boolean } | null>(null)
  // os alertas de vaga e os pedidos são do Acesso Família: sem passe, o painel não os promete
  const { completo } = useAcesso()

  if (user?.role === 'lar') {
    return (
      <section id="guardar" aria-labelledby="guardar-t" className={cn('tile scroll-mt-24 text-center', className)}>
        <h2 id="guardar-t" className="text-2xl font-semibold text-ink">
          Guardar perfis é para famílias
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-lg text-ink-mute">
          Tem sessão iniciada com uma conta de instituição. Para guardar este perfil, entre com uma conta de família.
        </p>
      </section>
    )
  }

  if (!user) {
    return (
      <section
        id="guardar"
        aria-labelledby="guardar-t"
        className={cn(
          'on-dark scroll-mt-24 rounded-[1.75rem] bg-ink px-6 py-14 text-center text-white sm:px-12 sm:py-20',
          className,
        )}
      >
        <h2 id="guardar-t" className="mx-auto max-w-2xl text-4xl font-semibold text-white sm:text-5xl">
          Guarde estas <em>respostas</em>.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-white/70 sm:text-xl">
          Com uma conta gratuita, o perfil passa para o seu painel e não tem de responder outra vez. Com o Acesso Família,
          avisamos quando abrir vaga.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <ButtonLink
            to="/registar"
            variant="accent"
            size="lg"
            className="w-full max-w-sm text-center whitespace-normal sm:w-auto sm:max-w-full"
          >
            Criar conta gratuita
          </ButtonLink>
          <TextLink to={`/entrar?voltar=${encodeURIComponent('/familia')}`} tone="light" className="min-h-12 px-3 text-lg">
            Já tenho conta
          </TextLink>
        </div>
      </section>
    )
  }

  const guardar = () => {
    if (precisaNome && !nome.trim()) {
      setErro('Indique o nome, para distinguir este perfil no seu painel.')
      nomeRef.current?.focus()
      return
    }
    const perfil = guardarPerfil(precisaNome ? nome : nomePorOmissao)
    if (perfil) setGuardado({ nome: perfil.nome, alterado: Boolean(r.id) })
  }

  if (guardado || (semAlteracoes && existente)) {
    const n = primeiroNome(guardado?.nome ?? existente!.nome)
    return (
      <section id="guardar" aria-labelledby="guardar-t" className={cn('tile scroll-mt-24 text-center', className)}>
        <h2 id="guardar-t" className="text-3xl font-semibold text-ink sm:text-4xl">
          {guardado
            ? guardado.alterado
              ? 'Alterações guardadas.'
              : `Perfil de ${n} guardado.`
            : `O perfil de ${n} está guardado.`}
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-lg text-ink-mute">
          {completo
            ? 'Avisamos quando abrir vaga. Os pedidos aos lares usam este perfil, sem repetir nada.'
            : 'Está no seu painel. Com o Acesso Família, os pedidos aos lares usam este perfil, sem repetir nada.'}
        </p>
        <ButtonLink to="/familia" size="lg" className="mt-8 w-full max-w-sm sm:w-auto" iconRight={<ChevronRight aria-hidden />}>
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
      <p className="mx-auto mt-4 max-w-lg text-lg text-ink-mute">
        {completo
          ? 'Para receber alertas de vaga e fazer pedidos sem repetir respostas.'
          : 'Fica no seu painel, para não repetir respostas. Com o Acesso Família, serve para pedir vaga em várias casas de uma vez.'}
      </p>
      <div className="mx-auto mt-8 flex max-w-md flex-col items-stretch gap-4 text-left">
        {precisaNome && (
          <InputField
            ref={nomeRef}
            label={`Nome ${p.de}`}
            value={nome}
            onChange={(e) => {
              setNome(e.target.value)
              setErro(undefined)
            }}
            error={erro}
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="done"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                guardar()
              }
            }}
          />
        )}
        <Button size="lg" onClick={guardar} className="w-full px-10 sm:w-auto sm:self-center">
          {r.id ? 'Guardar alterações' : 'Guardar perfil'}
        </Button>
      </div>
      <p className="mt-4 text-sm text-ink-mute">Fica só na sua conta. Pode apagá-lo quando quiser.</p>
    </section>
  )
}
