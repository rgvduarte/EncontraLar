import type { ReactNode } from 'react'
import { BadgeCheck, CircleDashed, Clock, PenLine, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { Lar, ResultadoVisita } from '@/types'
import { cn } from '@/lib/cn'
import { NIVEL_LABEL, nivelVerificacao, RESULTADO_LABEL, type EstadoContacto } from './pipeline'

const CHIP = 'inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap [&_svg]:size-4 [&_svg]:shrink-0'

/** Ponto de cor de cada resultado (sempre acompanhado do texto). */
export const RESULTADO_DOT: Record<ResultadoVisita, string> = {
  aderiu: 'bg-leaf-500',
  interessado: 'bg-terra-600',
  voltar: 'bg-sun-500',
  recusou: 'bg-dusk-500',
}

/** Resultado de uma visita: ponto + texto (+ quando). */
export function ResultadoChip({ resultado, quando, className }: { resultado: ResultadoVisita; quando?: string; className?: string }) {
  return (
    <span className={cn(CHIP, 'bg-sand text-ink', className)}>
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', RESULTADO_DOT[resultado])} />
      <span className="truncate">
        {RESULTADO_LABEL[resultado]}
        {quando && <span className="font-normal text-ink-mute"> · {quando}</span>}
      </span>
    </span>
  )
}

/** Nível de verificação atual: visitada pela equipa, só a licença, ou por verificar. */
export function NivelChip({ lar, className }: { lar: Pick<Lar, 'verificacao' | 'reviews'>; className?: string }) {
  const n = nivelVerificacao(lar)
  const Icon = n === 'visitada' ? BadgeCheck : n === 'licenca' ? ShieldCheck : CircleDashed
  return (
    <span className={cn(CHIP, n === 'visitada' ? 'bg-terra-50 text-terra-700' : n === 'licenca' ? 'bg-sand text-ink' : 'bg-sand text-ink-mute', className)}>
      <Icon aria-hidden />
      {NIVEL_LABEL[n]}
    </span>
  )
}

/** Próximo contacto: em atraso (vermelho), hoje (laranja) ou a data — sempre com texto e ícone. */
export function ContactoChip({ contacto, texto, className }: { contacto: EstadoContacto; texto: string; className?: string }) {
  const tom =
    contacto.tipo === 'atrasado' ? 'bg-alert-50 text-alert-700' : contacto.tipo === 'hoje' ? 'bg-sun-50 text-sun-800' : contacto.tipo === 'sem_data' ? 'bg-sand text-ink-mute' : 'bg-sand text-ink'
  return (
    <span className={cn(CHIP, tom, className)}>
      {contacto.tipo === 'atrasado' ? <TriangleAlert aria-hidden /> : <Clock aria-hidden />}
      {texto}
    </span>
  )
}

/** Uma etiqueta neutra (modalidade, conta, …). */
export function Etiqueta({ icon, children, className }: { icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn(CHIP, 'bg-sand text-ink-soft', className)}>
      {icon}
      {children}
    </span>
  )
}

/** "Rascunho por guardar" (o formulário desta instituição ficou a meio neste separador). */
export function RascunhoChip({ className }: { className?: string }) {
  return (
    <span className={cn(CHIP, 'bg-terra-50 text-terra-700', className)}>
      <PenLine aria-hidden />
      Rascunho por guardar
    </span>
  )
}

/** Secção do formulário da visita: título (h2), uma frase de apoio e o conteúdo. */
export function Secao({ id, titulo, texto, children, className }: { id: string; titulo: ReactNode; texto?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={`${id}-titulo`} id={id} className={cn('scroll-mt-28 border-t border-line pt-10', className)}>
      <h2 id={`${id}-titulo`} className="text-2xl font-semibold sm:text-3xl">
        {titulo}
      </h2>
      {texto && <p className="mt-1.5 text-ink-mute">{texto}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}

/** Ligação telefónica: "220 000 042" → "tel:+351220000042". */
export function telHref(telefone: string): string {
  const d = telefone.replace(/[^\d+]/g, '')
  return `tel:${/^\d{9}$/.test(d) ? `+351${d}` : d}`
}

/** Direções no Google Maps até à instituição (abre a app de mapas no telemóvel). */
export const comoChegarHref = (lar: Pick<Lar, 'lat' | 'lng'>) => `https://www.google.com/maps/dir/?api=1&destination=${lar.lat},${lar.lng}`
