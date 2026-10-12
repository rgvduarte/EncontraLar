import { Link } from 'react-router'
import { ChevronRight, Star } from 'lucide-react'
import type { Lar } from '@/types'
import { LarCover } from '@/components/lar/LarCover'
import { VerifiedBadge } from '@/components/lar/badges'
import { NATUREZA_LABEL, TIPO_LABEL } from '@/lib/labels'
import { tempoRelativo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { dividirNome, frescura } from './helpers'
import { useIrParaSecao } from './hooks'

export function Breadcrumbs({ lar }: { lar: Lar }) {
  const itens = [
    { to: '/', label: 'Início' },
    { to: '/pesquisa', label: 'Mapa de vagas' },
    { to: `/pesquisa?distrito=${encodeURIComponent(lar.distrito)}`, label: lar.distrito },
  ]
  return (
    <nav aria-label="Caminho" className="text-sm text-ink-mute">
      <ol className="flex flex-wrap items-center gap-x-1">
        {itens.map((i) => (
          <li key={i.to} className="flex items-center gap-1">
            <Link to={i.to} className="inline-flex min-h-12 items-center rounded-md transition-colors hover:text-ink">
              {i.label}
            </Link>
            <ChevronRight aria-hidden className="size-3.5 text-ink-mute/70" />
          </li>
        ))}
        <li aria-current="page" className="hidden max-w-full truncate text-ink-soft sm:block">
          {lar.nome}
        </li>
      </ol>
    </nav>
  )
}

/** "Vagas atualizadas há X pela instituição" — o sinal de confiança mais importante. */
function Frescura({ lar }: { lar: Lar }) {
  const f = frescura(lar.atualizadoEm)
  const quando = tempoRelativo(lar.atualizadoEm)
  return (
    <span className={cn('inline-flex items-center gap-2', f === 'antiga' ? 'text-sun-800' : 'text-ink-soft')}>
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', f === 'recente' ? 'bg-leaf-500' : f === 'normal' ? 'bg-ink-mute' : 'bg-sun-500')} />
      {f === 'antiga' ? `Vagas atualizadas ${quando} — confirme por telefone` : `Vagas atualizadas ${quando} pela instituição`}
    </span>
  )
}

/** Título, linha de contexto e sinais de confiança. */
export function LarHero({ lar }: { lar: Lar }) {
  const { prefixo, nucleo } = dividirNome(lar.nome)
  const irParaSecao = useIrParaSecao()
  const media = lar.avaliacao.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  return (
    <header className="animate-fade-up">
      <h1 className="text-[2.5rem] leading-[1.05] font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
        {prefixo ? (
          <>
            <span className="block text-ink-mute">{prefixo}</span> <span className="block">{nucleo}</span>
          </>
        ) : (
          nucleo
        )}
      </h1>
      <p className="mt-4 text-xl text-ink-mute">
        {TIPO_LABEL[lar.tipo]} · {NATUREZA_LABEL[lar.natureza]} · {lar.localidade}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        {lar.numAvaliacoes > 0 ? (
          <button
            type="button"
            onClick={() => irParaSecao('ficha-avaliacoes')}
            className="inline-flex min-h-12 items-center gap-1.5 text-ink transition-colors hover:text-terra-600"
            aria-label={`Avaliação ${media} em 5, ${lar.numAvaliacoes} avaliações. Ver avaliações`}
          >
            <Star aria-hidden className="size-4 fill-current" />
            <span className="font-semibold tabular">{media}</span>
            <span className="text-ink-mute">({lar.numAvaliacoes})</span>
          </button>
        ) : (
          <span className="inline-flex min-h-12 items-center text-ink-mute">Sem avaliações</span>
        )}
        <VerifiedBadge lar={lar} size="md" showPending />
        <Frescura lar={lar} />
      </div>
    </header>
  )
}

/** Capa grande (ilustração calma — sem fotografias no protótipo). */
export function LarCapa({ lar }: { lar: Lar }) {
  return (
    <div className="aspect-[4/3] animate-fade-up overflow-hidden rounded-[1.75rem] bg-sand sm:aspect-[16/10] sm:rounded-[2rem]">
      <LarCover hue={lar.capa.hue} variante={lar.capa.variante} />
    </div>
  )
}
