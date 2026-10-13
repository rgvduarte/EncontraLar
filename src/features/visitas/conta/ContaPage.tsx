import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { LogOut, Map } from 'lucide-react'
import { useCurrentUser, useVisitas } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { plural } from '@/lib/format'
import { Avatar } from '@/components/ui/misc'
import { Button, ButtonLink } from '@/components/ui/Button'
import { terminarSessao } from '@/components/layout/RequireAuth'
import { mesmoMes } from '../pipeline'

/** /visitas/conta — quem está com sessão iniciada, as suas visitas e terminar sessão (o separador "Conta" do telemóvel). */
export default function ContaPage() {
  useDocumentTitle('A sua conta')
  const user = useCurrentUser()
  const visitas = useVisitas()
  const navigate = useNavigate()
  const minhas = useMemo(() => visitas.filter((v) => v.equipaId === user?.id), [visitas, user])
  if (!user) return null
  const agora = new Date()
  const doMes = minhas.filter((v) => mesmoMes(v.data, agora)).length

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <section aria-labelledby="quem-titulo" className="flex items-center gap-5 rounded-[1.75rem] bg-sand p-6 sm:p-7">
        <Avatar nome={user.nome} className="size-16 text-xl" />
        <div className="min-w-0">
          <h2 id="quem-titulo" className="text-2xl font-semibold">
            {user.nome}
          </h2>
          <p className="text-ink-mute">Equipa de terreno · EncontraLar</p>
          <p className="mt-1 text-[0.9375rem] break-all text-ink-soft">
            {user.email}
            {user.telefone && <span className="whitespace-nowrap"> · {user.telefone}</span>}
          </p>
        </div>
      </section>

      <section aria-labelledby="minhas-titulo">
        <h2 id="minhas-titulo" className="text-2xl font-semibold">
          As suas visitas
        </h2>
        <p className="mt-2 text-lg text-ink-soft">
          {plural(doMes, 'visita', 'visitas')} este mês · {plural(minhas.length, 'visita', 'visitas')} no total.
        </p>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink to="/pesquisa" variant="subtle" size="lg" icon={<Map aria-hidden />} className="w-full sm:w-auto">
          Mapa de vagas
        </ButtonLink>
        <Button variant="subtle" size="lg" icon={<LogOut aria-hidden />} className="w-full sm:w-auto" onClick={() => void terminarSessao(navigate)}>
          Terminar sessão
        </Button>
      </div>
    </div>
  )
}
