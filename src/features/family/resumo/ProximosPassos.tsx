import { useState } from 'react'
import { Check } from 'lucide-react'
import type { PerfilIdoso } from '@/types'
import { cn } from '@/lib/cn'
import type { VisitaMarcada } from '../shared/data'
import { MoreLink, SectionHeader } from '../shared/ui'
import { nomeCurto } from '../shared/text'

const GUIA_KEY = 'encontralar:guia-visita-lido'

function lerGuiaLido(): boolean {
  try {
    return localStorage.getItem(GUIA_KEY) === '1'
  } catch {
    return false
  }
}

interface Passo {
  id: string
  titulo: string
  detalhe: string
  feito: boolean
  acao: { to: string; label: string; onClick?: () => void }
}

/** Lista curta de verificação, calculada a partir do estado real da conta. */
export function ProximosPassos({
  perfil,
  guardados,
  pedidos,
  visita,
  pesquisa,
}: {
  perfil: PerfilIdoso | undefined
  guardados: number
  pedidos: number
  visita: VisitaMarcada | undefined
  pesquisa: string
}) {
  const [guiaLido, setGuiaLido] = useState(lerGuiaLido)
  const marcarGuia = () => {
    setGuiaLido(true)
    try {
      localStorage.setItem(GUIA_KEY, '1')
    } catch {
      /* sem armazenamento: fica só nesta visita à página */
    }
  }

  const passos: Passo[] = [
    {
      id: 'perfil',
      titulo: 'Descrever a pessoa de quem cuida',
      detalhe: perfil ? `${nomeCurto(perfil.nome)}, ${perfil.idade} anos.` : 'As sugestões e os avisos passam a ser à medida.',
      feito: Boolean(perfil),
      acao: { to: '/familia/perfil', label: 'Criar perfil' },
    },
    {
      id: 'guardar',
      titulo: 'Guardar três instituições',
      detalhe: guardados >= 3 ? `${guardados} guardadas.` : `Tem ${guardados} de 3. Comparar ajuda a decidir.`,
      feito: guardados >= 3,
      acao: { to: pesquisa, label: 'Abrir o mapa' },
    },
    {
      id: 'pedir',
      titulo: 'Pedir vaga em duas ou mais',
      detalhe: pedidos >= 2 ? `${pedidos} pedidos feitos.` : 'As listas de espera andam a ritmos diferentes.',
      feito: pedidos >= 2,
      acao: { to: '/familia/guardados', label: 'Ver guardados' },
    },
    {
      id: 'visita',
      titulo: 'Marcar uma visita',
      detalhe: visita ? `${visita.lar.nome}.` : 'O melhor teste antes de decidir.',
      feito: Boolean(visita),
      acao: { to: '/familia/pedidos', label: 'Marcar visita' },
    },
    {
      id: 'guia',
      titulo: 'Preparar a visita',
      detalhe: guiaLido ? 'Guia lido.' : 'O que observar, o que perguntar e que documentos levar.',
      feito: guiaLido,
      acao: { to: '/guia#visita', label: 'Ler o guia', onClick: marcarGuia },
    },
  ]
  const feitos = passos.filter((p) => p.feito).length

  return (
    <section aria-labelledby="proximos-passos">
      <SectionHeader id="proximos-passos" title="Próximos passos" sub={`${feitos} de ${passos.length} feitos`} />
      <ol className="mt-6 divide-y divide-line border-y border-line">
        {passos.map((p) => (
          <li key={p.id} className="flex gap-4 py-5">
            <span
              aria-hidden
              className={cn(
                'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
                p.feito ? 'bg-ink text-white' : 'ring-[1.5px] ring-line-strong ring-inset',
              )}
            >
              {p.feito && <Check strokeWidth={3} className="size-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('font-medium', p.feito ? 'text-ink-mute' : 'text-ink')}>
                {p.titulo}
                <span className="sr-only">{p.feito ? ' — feito' : ' — por fazer'}</span>
              </p>
              <p className="text-sm text-ink-mute">{p.detalhe}</p>
              {!p.feito && (
                <MoreLink to={p.acao.to} onClick={p.acao.onClick} className="text-sm">
                  {p.acao.label}
                </MoreLink>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
