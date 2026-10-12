import { useEffect, type FormEvent } from 'react'
import { useLocation } from 'react-router'
import type { Lar } from '@/types'
import { Reveal, useLenis } from '@/components/motion'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { MoreLink } from '../shared/ui'
import { Apresentacao, Comodidades, Contactos, Cuidados, Equipa, Mensalidade, QuemRecebe } from './Campos'
import { Previa } from './Previa'
import { paraLar, useFichaForm } from './useFichaForm'
import { Verificacao } from './Verificacao'

/**
 * /gestao/ficha — a ficha pública, com pré-visualização em direto do cartão que as famílias veem.
 * Formulário numa só coluna; assim que há alterações, a barra "Guardar" sobe do fundo e fica presa
 * por cima da barra de abas (sticky, dentro do formulário — a ordem de leitura mantém-se natural).
 */
export default function FichaPage({ lar }: { lar: Lar }) {
  const form = useFichaForm(lar)
  const { hash } = useLocation()
  const lenis = useLenis()
  const preview: Lar = { ...lar, ...paraLar(form.r) }
  const assinatura = JSON.stringify(form.r)

  useEffect(() => {
    if (hash !== '#verificacao') return
    const el = document.getElementById('verificacao')
    if (!el) return
    if (lenis) lenis.scrollTo(el, { offset: -96 })
    else el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash, lenis])

  const submeter = (e: FormEvent) => {
    e.preventDefault()
    if (form.guardar()) {
      toast.success('Ficha guardada', 'As famílias já veem as alterações.')
    } else {
      toast.error('Falta corrigir alguns campos', 'Estão assinalados a vermelho.')
      requestAnimationFrame(() => {
        const el = document.querySelector('[aria-invalid="true"]') as HTMLElement | null
        if (!el) return
        // traz o campo para o centro do ecrã (com o scroll suave, se ativo) e só depois foca
        if (lenis) lenis.scrollTo(el, { offset: -Math.round(window.innerHeight / 3) })
        else el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.focus({ preventScroll: true })
      })
    }
  }

  return (
    <>
      <div className={cn('grid items-start gap-14 xl:grid-cols-[minmax(0,1fr)_19rem] xl:gap-12', form.sujo && 'pb-24')}>
        <div className="flex min-w-0 flex-col gap-10">
          <Reveal variant="blur">
            <Verificacao lar={lar} />
          </Reveal>
          <form id="ficha-form" onSubmit={submeter} noValidate className="flex flex-col gap-10">
            <Apresentacao {...form} />
            <Contactos {...form} />
            <QuemRecebe {...form} />
            <Cuidados {...form} />
            <Comodidades {...form} />
            <Mensalidade {...form} />
            <Equipa {...form} />

            <p className={cn('text-sm text-ink-mute transition-opacity duration-300', form.sujo && 'opacity-0')}>
              As alterações aparecem na ficha pública assim que as guardar.
            </p>
          </form>
        </div>

        <aside aria-labelledby="previa-titulo" className="flex flex-col gap-3 xl:sticky xl:top-24">
          <h2 id="previa-titulo" className="text-sm text-ink-mute">
            Como aparece na pesquisa
          </h2>
          <Previa lar={preview} assinatura={assinatura} />
          <MoreLink to={`/lar/${lar.id}`} className="self-start">
            Ver ficha pública
          </MoreLink>
        </aside>
      </div>

      {/*
      Barra "Guardar": âncora de altura zero, presa ao fundo do ecrã (por cima da barra de abas) em toda a
      página — formulário e pré-visualização. Sobe quando há alterações e desce depois de guardar.
    */}
      <div className="sticky bottom-[calc(var(--tabbar-h)+1rem)] z-[999] h-0">
        <div
          role="region"
          aria-label="Alterações por guardar"
          inert={!form.sujo}
          aria-hidden={!form.sujo || undefined}
          className={cn(
            'absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 rounded-full bg-white/90 py-2 pr-2 pl-6 shadow-lift ring-1 ring-black/5 backdrop-blur-xl backdrop-saturate-150 max-sm:pl-2',
            'transition-[transform,opacity] duration-500 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none',
            form.sujo ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-[calc(100%+var(--tabbar-h)+2rem)] opacity-0',
          )}
        >
          <p className="text-sm whitespace-nowrap text-ink-mute max-sm:sr-only">Alterações por guardar</p>
          <div className="flex gap-2 max-sm:w-full">
            <Button variant="subtle" onClick={form.repor} className="max-sm:min-h-13 max-sm:px-5">
              Repor
            </Button>
            <Button type="submit" form="ficha-form" disabled={!form.sujo} className="max-sm:min-h-13 max-sm:flex-1 max-sm:px-4">
              Guardar alterações
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
