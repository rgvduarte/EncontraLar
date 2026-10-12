import { Link } from 'react-router'
import type { PerfilIdoso, User } from '@/types'
import { Avatar } from '@/components/ui/misc'
import { MoreLink } from './ui'
import { nomeCurto } from './text'

/** Identidade no topo da barra lateral: quem está a usar e para quem procura. */
export function FamilyIdentity({ user, perfil }: { user: User; perfil: PerfilIdoso | undefined }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <Avatar nome={user.nome} />
        <p className="min-w-0 truncate font-semibold">{user.nome}</p>
      </div>
      {perfil ? (
        <p className="mt-4 text-sm text-ink-mute">
          A procurar para:
          <Link to="/familia/perfil" className="mt-0.5 block text-base leading-snug font-medium text-ink hover:underline">
            {nomeCurto(perfil.nome)}, {perfil.idade} anos
          </Link>
        </p>
      ) : (
        <MoreLink to="/familia/perfil" className="mt-2 text-sm">
          Criar perfil de cuidados
        </MoreLink>
      )}
    </div>
  )
}

/** Ajuda discreta no fundo da barra lateral. */
export function SidebarHelp() {
  return (
    <div className="px-3.5 text-sm">
      <p className="text-ink-mute">Vai visitar um lar?</p>
      <MoreLink to="/guia#visita">
        Guia da visita
      </MoreLink>
    </div>
  )
}
