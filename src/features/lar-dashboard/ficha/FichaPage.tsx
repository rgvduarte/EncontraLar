import { useEffect, type FormEvent } from 'react'
import { useLocation } from 'react-router'
import type { Lar } from '@/types'
import { LarCard } from '@/components/lar/LarCard'
import { useLenis } from '@/components/motion'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { MoreLink } from '../shared/ui'
import { Apresentacao, Comodidades, Contactos, Cuidados, Equipa, Mensalidade, QuemRecebe } from './Campos'
import { paraLar, useFichaForm } from './useFichaForm'
import { Verificacao } from './Verificacao'

/** /gestao/ficha — a ficha pública, com pré-visualização em direto do cartão que as famílias veem. */
export default function FichaPage({ lar }: { lar: Lar }) {
  const form = useFichaForm(lar)
  const { hash } = useLocation()
  const lenis = useLenis()
  const preview: Lar = { ...lar, ...paraLar(form.r) }

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
      requestAnimationFrame(() => (document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus())
    }
  }

  return (
    <div className="grid items-start gap-14 xl:grid-cols-[minmax(0,1fr)_19rem] xl:gap-12">
      <div className="flex min-w-0 flex-col gap-10">
        <Verificacao lar={lar} />
        <form onSubmit={submeter} noValidate className="flex flex-col gap-10">
          <Apresentacao {...form} />
          <Contactos {...form} />
          <QuemRecebe {...form} />
          <Cuidados {...form} />
          <Comodidades {...form} />
          <Mensalidade {...form} />
          <Equipa {...form} />

          <div className="sticky bottom-[calc(var(--tabbar-h)+1rem)] z-10 flex items-center justify-between gap-3 rounded-full bg-white/90 py-2 pr-2 pl-6 shadow-lift ring-1 ring-black/5 backdrop-blur-xl">
            <p aria-live="polite" className="text-sm text-ink-mute max-sm:sr-only">
              {form.sujo ? 'Tem alterações por guardar.' : 'Tudo guardado.'}
            </p>
            <div className="flex gap-2 max-sm:w-full">
              {form.sujo && (
                <Button variant="subtle" onClick={form.repor} className="max-sm:flex-1">
                  Repor
                </Button>
              )}
              <Button type="submit" disabled={!form.sujo} className="max-sm:flex-1">
                Guardar alterações
              </Button>
            </div>
          </div>
        </form>
      </div>

      <aside aria-labelledby="previa-titulo" className="flex flex-col gap-3 xl:sticky xl:top-24">
        <h2 id="previa-titulo" className="text-sm text-ink-mute">
          Como aparece na pesquisa
        </h2>
        <div inert>
          <LarCard lar={preview} />
        </div>
        <MoreLink to={`/lar/${lar.id}`} className="self-start">
          Ver ficha pública
        </MoreLink>
      </aside>
    </div>
  )
}
