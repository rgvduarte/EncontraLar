import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowUpRight } from 'lucide-react'
import type { Lar } from '@/types'
import { MapLegend, PortugalMap } from '@/components/brand/PortugalMap'
import { AzulejoBand, azulejoBg } from '@/components/brand/patterns'
import { vagasLivres } from '@/lib/forecast'
import { euro, tempoRelativo } from '@/lib/format'
import { TIPO_LABEL } from '@/lib/labels'

/** Cartão flutuante com a vaga atualizada mais recentemente — o produto a funcionar, no próprio hero. */
function UltimaVaga({ lares, agora }: { lares: Lar[]; agora: number }) {
  const lar = useMemo(
    () =>
      lares
        .filter((l) => l.tipo !== 'centro_dia' && vagasLivres(l) > 0)
        .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))[0],
    [lares],
  )
  if (!lar) return null
  const n = vagasLivres(lar)
  return (
    <Link
      to={`/lar/${lar.id}`}
      className="group absolute top-28 -left-24 z-10 hidden w-[17rem] rounded-2xl border border-line bg-white p-4 shadow-lift transition-transform hover:-translate-y-0.5 xl:block"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-pine-700 uppercase">
          <span aria-hidden className="size-2 animate-pulse-ring rounded-full bg-leaf-500" />
          Última vaga
        </span>
        <span className="text-xs text-ink-mute">{tempoRelativo(lar.atualizadoEm, new Date(agora))}</span>
      </span>
      <span className="mt-2 block font-display text-lg leading-snug font-semibold text-ink group-hover:underline">{lar.nome}</span>
      <span className="mt-0.5 block text-sm text-ink-soft">
        {lar.localidade} · {TIPO_LABEL[lar.tipo]}
      </span>
      <span className="mt-3 flex items-center justify-between gap-2 border-t border-dashed border-line-strong pt-3 text-sm">
        <span className="rounded-lg bg-leaf-50 px-2 py-0.5 font-bold whitespace-nowrap text-leaf-700">
          {n} {n === 1 ? 'vaga livre' : 'vagas livres'}
        </span>
        <span className="flex items-center gap-1 whitespace-nowrap text-ink-soft">
          desde <strong className="text-ink tabular">{euro(lar.mensalidadeMin)}</strong>
          <ArrowUpRight aria-hidden className="size-4 text-pine-700" />
        </span>
      </span>
    </Link>
  )
}

/**
 * O mapa de Portugal como "fotografia" do produto: moldura em areia com friso de azulejo,
 * um bloco de azulejo desencontrado por trás e uma legenda de revista.
 */
export function HeroMap({ lares, comVaga, agora }: { lares: Lar[]; comVaga: number; agora: number }) {
  const navigate = useNavigate()
  return (
    <figure className="relative mx-auto w-full max-w-md lg:max-w-none">
      {/* bloco de azulejo desencontrado, por trás da moldura */}
      <div
        aria-hidden
        className="absolute -right-3 -bottom-3 left-8 top-10 rounded-[2rem] bg-pine-900 sm:-right-5 sm:-bottom-5"
        style={azulejoBg('#80bbac', 0.32, 44)}
      />
      <UltimaVaga lares={lares} agora={agora} />
      <div className="relative overflow-hidden rounded-[2rem] border border-line-strong/70 bg-sand shadow-card">
        <AzulejoBand color="#1d564e" opacity={0.55} size={28} className="h-7 border-b border-line-strong/60 bg-white/60" />
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <p className="eyebrow">Portugal, hoje</p>
          <p className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-bold text-leaf-700 shadow-soft">
            <span aria-hidden className="size-2.5 animate-pulse-ring rounded-full bg-leaf-500" />
            <span className="tabular">{comVaga}</span> com vaga
          </p>
        </div>
        <div className="px-3 pt-1 pb-2 sm:px-5">
          <PortugalMap
            lares={lares}
            onSelect={(l) => navigate(`/lar/${l.id}`)}
            title={`Mapa de Portugal com ${lares.length} instituições; ${comVaga} têm vaga agora. Cada ponto abre a ficha da instituição.`}
          />
        </div>
        <figcaption className="border-t border-line-strong/50 bg-white/55 px-5 py-4">
          <MapLegend />
          <p className="mt-2 text-sm text-ink-soft">
            Cada ponto é uma instituição. Os verdes pulsam porque têm lugar livre hoje — toque num ponto para abrir a ficha.
          </p>
        </figcaption>
      </div>
    </figure>
  )
}
