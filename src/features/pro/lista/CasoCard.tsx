import { Link } from 'react-router'
import type { Candidatura, Caso, PerfilIdoso } from '@/types'
import { GRAU_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { contagemAlta, prazoTexto, pessoaCurta, resumirRespostas } from '../shared/caso'
import { AltaChip, EstadoCasoChip } from '../shared/ui'

/**
 * Um caso na lista: pessoa (nome abreviado e idade), dependência, contagem até à alta, resumo das respostas
 * e estado do caso. Uma vaga proposta é o destaque mais forte. O cartão inteiro leva ao caso.
 * `estatico`: sem ligação (pré-visualização na página de apresentação).
 */
export function CasoCard({
  caso,
  perfil,
  cands,
  estatico = false,
  headingLevel: H = 'h3',
  agora,
}: {
  caso: Caso
  perfil: PerfilIdoso
  cands: Candidatura[]
  estatico?: boolean
  headingLevel?: 'h2' | 'h3'
  agora?: number
}) {
  const alta = contagemAlta(caso.altaPrevista, caso.estado, agora)
  const r = resumirRespostas(cands)
  const proposta = r.propostas[0]
  const fechado = caso.estado !== 'aberto'
  const titulo = pessoaCurta(perfil)

  return (
    <article
      className={cn(
        'relative flex h-full flex-col rounded-[1.75rem] bg-white p-6 ring-1 ring-line sm:p-7',
        !estatico && 'transition-[box-shadow,translate] duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-0.5 hover:shadow-card',
        proposta && 'ring-2 ring-terra-600',
      )}
    >
      {/* telemóvel: o estado vem por cima do nome (o nome não parte em duas linhas por causa da etiqueta) */}
      <div className="flex flex-col-reverse items-start gap-2 sm:flex-row sm:justify-between sm:gap-4">
        <H className={cn('text-xl leading-tight font-semibold sm:text-2xl', fechado && 'text-ink-soft')}>
          {estatico ? (
            titulo
          ) : (
            <Link
              to={`/casos/${encodeURIComponent(caso.id)}`}
              className="after:absolute after:inset-0 after:rounded-[1.75rem] focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-offset-2 focus-visible:after:outline-terra-500"
            >
              {titulo}
            </Link>
          )}
        </H>
        <EstadoCasoChip estado={caso.estado} className="shrink-0 sm:-mt-0.5" />
      </div>
      <p className="mt-1.5 text-ink-mute">
        {GRAU_LABEL[perfil.grau]}
        {caso.referencia && (
          <>
            {' · '}
            <span className="whitespace-nowrap">{caso.referencia}</span>
          </>
        )}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <AltaChip alta={alta} />
        {alta.extenso && alta.dias != null && alta.dias >= 0 && alta.dias <= 14 && <span className="text-sm text-ink-mute first-letter:uppercase">{alta.extenso}</span>}
      </div>

      <p className={cn('mt-4 text-[0.9375rem] leading-snug', r.enviados ? 'text-ink-soft' : 'text-ink-mute')}>{r.texto}</p>

      {proposta && (
        <p className="mt-5 rounded-2xl bg-terra-600 px-4 py-3 leading-snug font-semibold text-white">
          {r.propostas.length > 1 ? `${r.propostas.length} vagas propostas` : 'Vaga proposta'}
          {proposta.prazoResposta ? `: responda até ${prazoTexto(proposta.prazoResposta)}` : ': responda à instituição'}
        </p>
      )}
    </article>
  )
}
