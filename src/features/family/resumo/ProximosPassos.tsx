import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Check } from 'lucide-react'
import type { PerfilIdoso } from '@/types'
import { Meter } from '@/components/ui/misc'
import { tempoRelativo } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { VisitaMarcada } from '../shared/data'
import { diaPorExtenso, nomeCurto } from '../shared/text'

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
  feito: boolean
  detalhe: string
  acao: { to: string; label: string; onClick?: () => void }
}

/** Lista de verificação calculada a partir do estado real da conta. */
export function ProximosPassos({
  perfil,
  guardados,
  visita,
  pesquisa,
}: {
  perfil: PerfilIdoso | undefined
  guardados: number
  visita: VisitaMarcada | undefined
  pesquisa: string
}) {
  const [guiaLido, setGuiaLido] = useState(lerGuiaLido)
  const marcarGuia = () => {
    setGuiaLido(true)
    try {
      localStorage.setItem(GUIA_KEY, '1')
    } catch {
      /* sem armazenamento: fica só nesta sessão */
    }
  }

  const passos: Passo[] = [
    {
      id: 'perfil',
      titulo: 'Descrever a pessoa de quem cuida',
      feito: Boolean(perfil),
      detalhe: perfil
        ? `${nomeCurto(perfil.nome)}, ${perfil.idade} anos — atualizado ${tempoRelativo(perfil.atualizadoEm)}.`
        : 'Com o perfil de cuidados, as sugestões e os alertas passam a ser à medida.',
      acao: { to: '/familia/perfil', label: perfil ? 'Rever perfil' : 'Criar perfil' },
    },
    {
      id: 'guardados',
      titulo: 'Guardar pelo menos 3 instituições',
      feito: guardados >= 3,
      detalhe:
        guardados >= 3
          ? `${guardados} guardadas — já pode compará-las lado a lado.`
          : `Tem ${guardados} de 3. Comparar várias ajuda a decidir com calma.`,
      acao: guardados >= 3 ? { to: '/familia/guardados', label: 'Comparar' } : { to: pesquisa, label: 'Procurar no mapa' },
    },
    {
      id: 'visita',
      titulo: 'Marcar uma visita',
      feito: Boolean(visita),
      detalhe: visita
        ? `${visita.lar.nome}, ${diaPorExtenso(visita.quando)}.`
        : 'Ver o lar ao vivo é o melhor teste antes de decidir.',
      acao: { to: '/familia/pedidos', label: visita ? 'Ver pedidos' : 'Marcar visita' },
    },
    {
      id: 'guia',
      titulo: 'Ler o guia da visita',
      feito: guiaLido,
      detalhe: guiaLido ? 'Leve-o consigo no telemóvel no dia da visita.' : 'O que observar, o que perguntar e que documentos levar.',
      acao: { to: '/guia#visita', label: guiaLido ? 'Abrir guia' : 'Ler o guia', onClick: marcarGuia },
    },
  ]
  const feitos = passos.filter((p) => p.feito).length

  return (
    <section aria-labelledby="proximos-passos" className="rounded-[1.75rem] border border-line bg-white p-6 shadow-card">
      <p className="eyebrow">Próximos passos</p>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <h2 id="proximos-passos" className="font-display text-2xl font-semibold">
          {feitos === passos.length ? (
            <>
              Tudo <em>em dia</em>
            </>
          ) : (
            'O que falta fazer'
          )}
        </h2>
        <p className="shrink-0 text-sm font-bold text-ink-soft tabular">
          {feitos} de {passos.length}
        </p>
      </div>
      <Meter value={feitos / passos.length} tone="leaf" className="mt-3" label={`${feitos} de ${passos.length} passos feitos`} />
      <ol className="mt-4">
        {passos.map((p, i) => (
          <li key={p.id} className="flex gap-4 border-t border-dashed border-line py-4 first:border-t-0">
            <span aria-hidden className="flex w-8 shrink-0 justify-center pt-0.5">
              {p.feito ? (
                <span className="flex size-7 items-center justify-center rounded-full bg-pine-700 text-white">
                  <Check strokeWidth={3} className="size-4" />
                </span>
              ) : (
                <span className="font-display text-3xl leading-none font-semibold text-terra-600 tabular">{i + 1}</span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('leading-snug font-bold', p.feito ? 'text-ink-soft' : 'text-ink')}>
                {p.titulo}
                <span className="sr-only">{p.feito ? ' — feito' : ' — por fazer'}</span>
              </p>
              <p className="mt-0.5 text-sm text-ink-soft">{p.detalhe}</p>
              {!p.feito && (
                <Link to={p.acao.to} onClick={p.acao.onClick} className="link mt-1 inline-flex min-h-11 items-center gap-1 text-sm">
                  {p.acao.label}
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
