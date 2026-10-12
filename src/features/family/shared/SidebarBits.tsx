import { Link } from 'react-router'
import { ArrowRight, BookOpenText, HandCoins } from 'lucide-react'
import type { PerfilIdoso, User } from '@/types'
import { Avatar } from '@/components/ui/misc'
import { AzulejoBand } from '@/components/brand/patterns'
import { GRAU_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { nomeCurto } from './text'

/** Bloco de identidade no topo da barra lateral. */
export function FamilyIdentity({ user, perfil }: { user: User; perfil: PerfilIdoso | undefined }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <Avatar nome={user.nome} className="size-12 text-lg" />
        <div className="min-w-0">
          <p className="truncate font-bold">{user.nome}</p>
          <p className="text-xs font-bold tracking-[0.1em] text-pine-700 uppercase">Conta de família</p>
        </div>
      </div>
      <div className="mt-4 border-t border-dashed border-line-strong pt-4">
        <p className="text-sm text-ink-soft">A procurar lar para</p>
        {perfil ? (
          <Link to="/familia/perfil" className="group mt-0.5 block rounded-lg">
            <span className="font-display text-xl leading-tight font-semibold group-hover:underline">
              {nomeCurto(perfil.nome)}, {perfil.idade} anos
            </span>
            <span className="mt-1 block text-sm text-ink-soft">
              {perfil.relacao} · {GRAU_LABEL[perfil.grau]}
            </span>
          </Link>
        ) : (
          <Link to="/familia/perfil" className="link mt-1 inline-flex min-h-11 items-center gap-1 text-sm">
            Criar perfil de cuidados
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
      </div>
    </div>
  )
}

/** Cartão de ajuda: o guia da visita e os apoios. */
export function HelpCard({ className }: { className?: string }) {
  return (
    <aside aria-label="Ajuda" className={cn('relative overflow-hidden rounded-3xl border border-line bg-sand p-5', className)}>
      <AzulejoBand color="#1d564e" size={36} className="absolute -top-2 -right-2 size-20 rotate-6 opacity-20" />
      <p className="relative font-display text-lg leading-snug font-semibold">Vai visitar um lar?</p>
      <p className="relative mt-1 text-sm text-ink-soft">O que observar, o que perguntar e que documentos levar no dia.</p>
      <ul className="relative mt-3 flex flex-col">
        <li>
          <Link to="/guia#visita" className="flex min-h-11 items-center gap-2 text-sm font-bold text-pine-800 hover:underline">
            <BookOpenText aria-hidden className="size-4.5" />
            Guia da visita
          </Link>
        </li>
        <li>
          <Link to="/guia#apoios" className="flex min-h-11 items-center gap-2 text-sm font-bold text-pine-800 hover:underline">
            <HandCoins aria-hidden className="size-4.5" />
            Apoios e comparticipações
          </Link>
        </li>
      </ul>
    </aside>
  )
}
