import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Star } from 'lucide-react'
import type { Lar } from '@/types'
import { LarCover } from '@/components/lar/LarCover'
import { VerifiedBadge } from '@/components/lar/badges'
import { NATUREZA_LABEL, TIPO_LABEL } from '@/lib/labels'
import { tempoRelativo } from '@/lib/format'
import { Parallax, Reveal, ScrollZoom } from '@/components/motion'
import { cn } from '@/lib/cn'
import { dividirNome, frescura } from './helpers'
import { useIrParaSecao } from './hooks'

/** Chave escrita pela página de pesquisa com a rota atual (caminho + filtros). */
const ULTIMA_PESQUISA = 'encontralar:ultima-pesquisa'

/** A última pesquisa da sessão (ex.: "/pesquisa?lugar=Porto&vaga=agora"), para o "Mapa de vagas" não perder os filtros. */
function ultimaPesquisa(): string {
  try {
    const v = sessionStorage.getItem(ULTIMA_PESQUISA)
    if (v && /^\/pesquisa(\?|$)/.test(v)) return v
  } catch {
    /* sem armazenamento: usa a pesquisa vazia */
  }
  return '/pesquisa'
}

export function Breadcrumbs({ lar }: { lar: Lar }) {
  const [mapa] = useState(ultimaPesquisa)
  const itens = [
    { to: '/', label: 'Início' },
    { to: mapa, label: 'Mapa de vagas' },
    { to: `/pesquisa?distrito=${encodeURIComponent(lar.distrito)}`, label: lar.distrito },
  ]
  return (
    <nav aria-label="Caminho" className="text-sm text-ink-mute">
      <ol className="flex flex-wrap items-center gap-x-1">
        {itens.map((i, idx) => (
          <li key={i.label} className="flex items-center gap-1">
            <Link to={i.to} className="inline-flex min-h-12 items-center rounded-md transition-colors hover:text-ink">
              {i.label}
            </Link>
            {/* no telemóvel o nome da instituição não aparece: sem "›" pendurado no fim */}
            <ChevronRight aria-hidden className={cn('size-3.5 text-ink-mute/70', idx === itens.length - 1 && 'max-sm:hidden')} />
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
      <span
        aria-hidden
        className={cn('size-2 shrink-0 rounded-full', f === 'recente' ? 'bg-leaf-500' : f === 'normal' ? 'bg-ink-mute' : 'bg-sun-500')}
      />
      {f === 'antiga' ? `Vagas atualizadas ${quando} — confirme por telefone` : `Vagas atualizadas ${quando} pela instituição`}
    </span>
  )
}

/**
 * Título, linha de contexto e sinais de confiança — o "gancho" da página.
 * Entram em sequência com desfoque (título → contexto → confiança), como nas páginas de produto da Apple.
 */
export function LarHero({ lar }: { lar: Lar }) {
  const { prefixo, nucleo } = dividirNome(lar.nome)
  const irParaSecao = useIrParaSecao()
  const media = lar.avaliacao.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  return (
    <header>
      <Reveal variant="blur" duration={1100}>
        <h1 className="text-[2.5rem] leading-[1.05] font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
          {prefixo ? (
            <>
              <span className="block text-ink-mute">{prefixo}</span> <span className="block">{nucleo}</span>
            </>
          ) : (
            nucleo
          )}
        </h1>
      </Reveal>
      <Reveal variant="blur" delay={140}>
        <p className="mt-3 text-lg text-ink-mute sm:mt-4 sm:text-xl">
          {TIPO_LABEL[lar.tipo]} · {NATUREZA_LABEL[lar.natureza]} · {lar.localidade}
        </p>
      </Reveal>

      <Reveal variant="up" delay={260}>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 text-sm sm:mt-4 sm:gap-y-1">
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
      </Reveal>
    </header>
  )
}

/**
 * Capa (ilustração calma — sem fotografias no protótipo), com o "zoom de produto": cresce e perde
 * arredondamento ao subir no ecrã. No desktop, a ilustração tem ainda uma paralaxe subtil por dentro da moldura.
 * No telemóvel é mais baixa (16:10) para o cartão de preço e vagas ficar perto.
 */
export function LarCapa({ lar }: { lar: Lar }) {
  return (
    <ScrollZoom from={0.92} radiusFrom={48} radiusTo={28} className="relative aspect-[16/10] bg-sand">
      <div className="absolute inset-0">
        <Parallax speed={22} className="h-full">
          <div className="h-full scale-[1.12]">
            <LarCover hue={lar.capa.hue} variante={lar.capa.variante} />
          </div>
        </Parallax>
      </div>
    </ScrollZoom>
  )
}
