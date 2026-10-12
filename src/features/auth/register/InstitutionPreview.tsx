import { BedDouble, MapPin, ShieldQuestion } from 'lucide-react'
import type { Natureza, TipoResposta } from '@/types'
import { LarCover } from '@/components/lar/LarCover'
import { Badge } from '@/components/ui/Badge'
import { NATUREZA_LABEL, TIPO_LABEL } from '@/lib/labels'
import { euro, plural } from '@/lib/format'
import { cn } from '@/lib/cn'
import { lugarCanonico, lugarPorLabel } from './LugarCombobox'

export interface InstitutionDraft {
  instNome: string
  tipo: string
  natureza: string
  lugar: string
  capacidade: string
  precoDesde: string
}

/** Hash simples e estável do nome → ilustração da fachada (muda enquanto escreve, como "provas" de capa). */
function capaDe(nome: string) {
  let h = 0
  for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return { hue: h % 360, variante: (h >> 9) % 4 }
}

/** Pré-visualização ao vivo do cartão da instituição tal como aparece nas pesquisas. */
export function InstitutionPreview({ draft, className }: { draft: InstitutionDraft; className?: string }) {
  const nome = draft.instNome.trim()
  const lugar = lugarCanonico(draft.lugar)
  const distrito = lugar ? lugarPorLabel(lugar)?.distrito : undefined
  const capacidade = /^\d+$/.test(draft.capacidade.trim()) ? Number(draft.capacidade.trim()) : null
  const preco = /^\d+$/.test(draft.precoDesde.trim()) ? Number(draft.precoDesde.trim()) : null
  const tipo = (draft.tipo || 'erpi') as TipoResposta
  const natureza = draft.natureza ? (draft.natureza as Natureza) : null
  const capa = capaDe(nome || 'EncontraLar')

  const vazio = <span className="text-ink-mute italic">a preencher</span>

  return (
    <figure className={cn('flex flex-col gap-3', className)}>
      <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-card" aria-hidden>
        <div className="relative h-36">
          <LarCover hue={capa.hue} variante={capa.variante} />
          <Badge tone="white" className="absolute top-3 left-3" icon={<ShieldQuestion aria-hidden />}>
            Verificação em curso
          </Badge>
        </div>
        <div className="flex flex-col gap-2 p-5">
          <p className="text-sm font-semibold text-ink-soft">
            {TIPO_LABEL[tipo]}
            {natureza && <> · {NATUREZA_LABEL[natureza]}</>}
          </p>
          <p className={cn('font-display text-xl leading-snug font-semibold', !nome && 'text-ink-mute italic')}>
            {nome || 'Nome da instituição'}
          </p>
          <p className="flex items-center gap-1.5 text-sm text-ink-soft">
            <MapPin aria-hidden className="size-4 shrink-0 text-terra-600" />
            {lugar ? (
              <>
                {lugar.split(' — ')[0]}
                {distrito && distrito !== lugar.split(' — ')[0] && <> · distrito de {distrito}</>}
              </>
            ) : (
              vazio
            )}
          </p>
          <div className="mt-2 flex items-end justify-between gap-3 border-t border-line pt-3">
            <p className="text-sm text-ink-soft">
              <span className="block">Mensalidade desde</span>
              <span className="font-display text-2xl font-semibold text-ink tabular">{preco != null ? euro(preco) : '— €'}</span>
            </p>
            <p className="flex items-center gap-1.5 text-sm text-ink-soft">
              <BedDouble aria-hidden className="size-4.5" />
              {capacidade ? plural(capacidade, 'lugar', 'lugares') : vazio}
            </p>
          </div>
        </div>
      </div>
      <figcaption className="text-sm text-ink-soft">
        Pré-visualização do cartão nas pesquisas. Depois do registo, completa a ficha no painel: cuidados, equipa, quartos e vagas livres.
      </figcaption>
    </figure>
  )
}
