import { useId } from 'react'
import type { MetodoPagamentoFamilia } from '@/types'
import { ACESSO_DESDE } from '@/components/acesso'
import { useAcesso } from '@/lib/store'
import { linkAcesso } from '@/lib/acesso'
import { cn } from '@/lib/cn'
import { MoreLink } from './ui'

/**
 * Acesso Família no painel (docs/MODELO-NEGOCIO.md): o estado do passe e as frases que o painel repete.
 * O bloqueio em si (vagas, preços, previsão, contactos) faz-se em cada secção com `useAcesso().completo`.
 */

export const METODO_LABEL: Record<MetodoPagamentoFamilia, string> = {
  mbway: 'MB WAY',
  multibanco: 'Multibanco',
  cartao: 'Cartão',
}

/** "1 de janeiro" (com o ano quando não é o ano corrente). */
export function diaAte(iso: string, agora = new Date()): string {
  const d = new Date(iso)
  return d.toLocaleDateString(
    'pt-PT',
    d.getFullYear() === agora.getFullYear() ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' },
  )
}

export const faltamDias = (n: number) => (n === 1 ? 'falta 1 dia' : `faltam ${n} dias`)

/** O que o passe acrescenta, numa linha (palavras da lista canónica). */
export const BENEFICIOS_LINHA =
  'Com o Acesso Família: que instituições têm vaga, preços por quarto, previsão de espera, contactos e pedidos a várias casas.'

/**
 * Estado do passe no Resumo, numa linha:
 * - com passe: "Acesso Família · ativo até 1 de janeiro · faltam 80 dias" e "Somar dias";
 * - sem passe: "Versão grátis", o que o passe acrescenta e "Ver o Acesso Família".
 */
export function AcessoEstado({ voltar = '/familia', className }: { voltar?: string; className?: string }) {
  const { ativo, ate, diasRestantes } = useAcesso()
  const id = useId()
  const caixa = cn(
    'flex flex-col gap-3 rounded-[1.75rem] bg-sand px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-8 sm:py-6',
    className,
  )

  if (ativo && ate) {
    return (
      <section aria-labelledby={id} className={caixa}>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-lg leading-snug">
          <h2 id={id} className="text-lg font-semibold">
            Acesso Família
          </h2>
          <p className="text-ink-mute">
            <span aria-hidden>· </span>ativo até {diaAte(ate)} <span aria-hidden>·</span> {faltamDias(diasRestantes)}
          </p>
        </div>
        <MoreLink to={linkAcesso(voltar)} className="shrink-0">
          Somar dias<span className="sr-only"> ao Acesso Família</span>
        </MoreLink>
      </section>
    )
  }

  return (
    <section aria-labelledby={id} className={caixa}>
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-semibold">
          Versão grátis
        </h2>
        <p className="mt-0.5 max-w-2xl text-ink-mute">{BENEFICIOS_LINHA}</p>
        {ate && <p className="mt-1 text-sm text-ink-mute">O último passe terminou a {diaAte(ate)}.</p>}
      </div>
      <div className="flex shrink-0 flex-wrap items-baseline gap-x-3 sm:flex-col sm:items-end sm:gap-0">
        <MoreLink to={linkAcesso(voltar)}>
          Ver o Acesso Família
        </MoreLink>
        <span className="text-sm text-ink-mute">{ACESSO_DESDE}</span>
      </div>
    </section>
  )
}
