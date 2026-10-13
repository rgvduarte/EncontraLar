/**
 * Os dois passes do Acesso Família, lado a lado (empilhados no telemóvel). O de 90 dias é o recomendado:
 * cartão preto, como os blocos de contraste do site. A ação depende de quem está a ver (ver `Visitante`).
 */
import type { ReactNode } from 'react'
import type { PlanoFamiliaId } from '@/types'
import { PLANOS_FAMILIA, precoTexto, type PlanoFamilia } from '@/lib/acesso'
import { cn } from '@/lib/cn'
import { Button, ButtonLink, TextLink } from '@/components/ui/Button'
import { Reveal } from '@/components/motion'
import { linkEntrar, linkRegisto, porDiaTexto, type Visitante } from './compra'
import { IvaSemRenovacao } from './texto'

function AcaoPasse({
  plano,
  visitante,
  voltar,
  onEscolher,
}: {
  plano: PlanoFamilia
  visitante: Visitante
  voltar: string | null
  onEscolher: (p: PlanoFamiliaId) => void
}) {
  const rotulo = `${visitante === 'familia-ativa' ? 'Somar' : 'Ativar'} ${plano.nome}`
  const variant = plano.destaque ? 'inverse' : 'primary'
  // sem conta: criar a conta de família e voltar aqui com o passe escolhido (a folha abre sozinha)
  if (visitante === 'convidado')
    return (
      <ButtonLink to={linkRegisto(plano.id, voltar)} size="lg" variant={variant} full>
        {rotulo}
      </ButtonLink>
    )
  if (visitante === 'familia' || visitante === 'familia-ativa')
    return (
      <Button size="lg" variant={variant} full aria-haspopup="dialog" onClick={() => onEscolher(plano.id)}>
        {rotulo}
      </Button>
    )
  // instituições e profissionais: a explicação está no topo da página
  return null
}

function CartaoPasse({ plano, acao }: { plano: PlanoFamilia; acao: ReactNode }) {
  const escuro = !!plano.destaque
  const titulo = `passe-${plano.id}`
  return (
    <article
      aria-labelledby={titulo}
      className={cn('flex h-full flex-col rounded-[1.75rem] p-7 sm:p-10', escuro ? 'on-dark bg-pine-950 text-white' : 'bg-sand text-ink')}
    >
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3 id={titulo} className="text-2xl font-semibold">
          {plano.nome}
        </h3>
        {escuro && <span className="rounded-full bg-white px-3.5 py-1 text-sm font-semibold text-ink">Recomendado</span>}
      </div>
      <p className="mt-5 text-[2.75rem] leading-none font-semibold tracking-tight tabular sm:text-5xl">{precoTexto(plano.precoCentimos)}</p>
      <p className={cn('mt-3 text-base', escuro ? 'text-pine-300' : 'text-ink-mute')}>
        <IvaSemRenovacao />
      </p>
      <p className={cn('mt-6 text-lg', escuro ? 'text-white/85' : 'text-ink-soft')}>{plano.resumo}</p>
      <p className={cn('mt-1 text-lg tabular', escuro ? 'text-pine-300' : 'text-ink-mute')}>{porDiaTexto(plano)}</p>
      {acao && <div className="mt-8 md:mt-auto md:pt-8">{acao}</div>}
    </article>
  )
}

export function Passes({
  visitante,
  voltar,
  planoUrl,
  onEscolher,
}: {
  visitante: Visitante
  /** para onde voltar depois de comprar (já validado) */
  voltar: string | null
  /** o passe pedido no endereço (segue para "Entrar") */
  planoUrl: PlanoFamiliaId | null
  onEscolher: (p: PlanoFamiliaId) => void
}) {
  return (
    <section id="passes" aria-labelledby="acesso-passes" className="container-page scroll-mt-24 pb-20 sm:pb-32 lg:pb-40">
      <h2 id="acesso-passes" className="sr-only">
        Os passes
      </h2>
      <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
        {PLANOS_FAMILIA.map((p, i) => (
          <Reveal key={p.id} delay={i * 110}>
            <CartaoPasse plano={p} acao={<AcaoPasse plano={p} visitante={visitante} voltar={voltar} onEscolher={onEscolher} />} />
          </Reveal>
        ))}
      </div>

      {visitante === 'convidado' && (
        <div className="mx-auto mt-8 flex max-w-[44ch] flex-col items-center text-center text-lg text-ink-mute">
          <p>Para ativar, crie uma conta de família, gratuita.</p>
          <p className="flex flex-wrap items-center justify-center gap-x-1.5">
            Já tem conta?
            <TextLink to={linkEntrar(planoUrl, voltar)}>Entrar</TextLink>
          </p>
        </div>
      )}
      {visitante === 'familia-ativa' && (
        <p className="mx-auto mt-8 max-w-[44ch] text-center text-lg text-ink-mute">Os dias que somar juntam-se aos que faltam.</p>
      )}
    </section>
  )
}
