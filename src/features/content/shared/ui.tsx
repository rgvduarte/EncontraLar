/**
 * Peças pequenas partilhadas pelas páginas de conteúdo (para lares, guia, sobre, privacidade, 404).
 * Minimalistas: texto, espaço e uma ligação azul — sem caixas nem ícones decorativos.
 */
import type { ReactNode } from 'react'
import { Link, type To } from 'react-router'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { useMediaQuery } from '@/lib/hooks'
import { cn } from '@/lib/cn'

/** Ligação externa: abre noutro separador e di-lo ao leitor de ecrã. */
export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn('link inline-flex items-center gap-0.5', className)}>
      {children}
      <ArrowUpRight aria-hidden className="size-[0.9em] shrink-0" />
      <span className="sr-only"> (abre noutro separador)</span>
    </a>
  )
}

const MORE = 'inline-flex min-h-12 items-center gap-0.5 font-medium transition-colors hover:underline underline-offset-4'
const MORE_TONE = {
  light: 'text-terra-600 hover:text-terra-700',
  /** sobre bg-sand: o azul mais escuro mantém o contraste AA */
  sand: 'text-terra-700 hover:text-terra-800',
  dark: 'text-terra-300 hover:text-terra-200',
} as const

/** Ligação de texto estilo Apple: "Saber mais ›". Com `to` é uma rota; com `onClick` é um botão. */
export function MoreLink({
  to,
  onClick,
  children,
  className,
  tone = 'light',
}: {
  to?: To
  onClick?: () => void
  children: ReactNode
  className?: string
  /** 'sand' sobre cinza claro, 'dark' sobre preto */
  tone?: keyof typeof MORE_TONE
}) {
  const inner = (
    <>
      {children}
      <ChevronRight aria-hidden className="size-[1.05em] shrink-0 translate-y-px" />
    </>
  )
  if (to)
    return (
      <Link
        to={to}
        onClick={
          onClick
            ? (e) => {
                e.preventDefault()
                onClick()
              }
            : undefined
        }
        className={cn(MORE, MORE_TONE[tone], className)}
      >
        {inner}
      </Link>
    )
  return (
    <button type="button" onClick={onClick} className={cn(MORE, MORE_TONE[tone], className)}>
      {inner}
    </button>
  )
}

/** Entrada "blur-up" do topo da página (só CSS: corre ao montar, sem esperar pelo scroll). */
export const BLUR_UP = 'animate-[page-in_0.95s_cubic-bezier(.16,1,.3,1)_both] motion-reduce:animate-none'

/**
 * Cabeçalho de página centrado (h1). Entra em cascata (eyebrow → título, linha a linha → subtítulo → ações)
 * com um leve desfoque, como nas páginas de produto da Apple. Para escalonar o título por linhas,
 * passe `title` como lista (cada elemento é uma linha).
 */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  children,
  className,
  titleWidth = 'max-w-[16ch]',
}: {
  eyebrow?: ReactNode
  title: ReactNode | ReactNode[]
  subtitle?: ReactNode
  children?: ReactNode
  className?: string
  /** largura máxima do h1 (classe max-w-*) */
  titleWidth?: string
}) {
  const linhas = Array.isArray(title) ? title : null
  const depois = 120 + (linhas ? linhas.length : 1) * 110
  return (
    <header className={cn('container-narrow flex flex-col items-center pt-14 pb-12 text-center sm:pt-24 sm:pb-20 lg:pt-28', className)}>
      {eyebrow && <p className={cn('eyebrow mb-4', BLUR_UP)}>{eyebrow}</p>}
      <h1 className={cn(titleWidth, 'text-[2.5rem] leading-[1.06] font-semibold text-ink sm:text-6xl lg:text-7xl', !linhas && BLUR_UP)} style={linhas ? undefined : { animationDelay: '110ms' }}>
        {linhas
          ? linhas.map((l, i) => (
              <span key={i} className={cn('block', BLUR_UP)} style={{ animationDelay: `${110 + i * 110}ms` }}>
                {l}
              </span>
            ))
          : title}
      </h1>
      {subtitle && (
        <p className={cn('mt-5 max-w-[38ch] text-xl leading-snug text-ink-mute sm:mt-6 sm:text-2xl', BLUR_UP)} style={{ animationDelay: `${depois}ms` }}>
          {subtitle}
        </p>
      )}
      {children && (
        <div className={cn('mt-8 w-full', BLUR_UP)} style={{ animationDelay: `${depois + 120}ms` }}>
          {children}
        </div>
      )}
    </header>
  )
}

/** Classes de cada cartão de uma faixa deslizável (ver SwipeRow; `SWIPE_ITEM_LG` com `ate="lg"`). */
export const SWIPE_ITEM = 'w-[84%] max-w-[24rem] shrink-0 snap-start md:w-auto md:max-w-none'
export const SWIPE_ITEM_LG = 'w-[84%] max-w-[24rem] shrink-0 snap-start lg:w-auto lg:max-w-none'

// overflow-y-hidden + overscroll-y-auto!: a faixa só desliza na horizontal; um gesto vertical que comece nela
// passa para a página (o lenis.css põe overscroll-behavior: contain nos dois eixos)
const SWIPE_BASE =
  '-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain overscroll-y-auto! px-5 pt-1 pb-6 [scrollbar-width:none] sm:-mx-8 sm:scroll-px-8 sm:px-8 [&::-webkit-scrollbar]:hidden'
const SWIPE_FIM = {
  md: 'md:mx-0 md:overflow-visible md:px-0 md:pt-0 md:pb-0',
  lg: 'lg:mx-0 lg:overflow-visible lg:px-0 lg:pt-0 lg:pb-0',
} as const

/**
 * Telemóvel (e tablet, com `ate="lg"`): faixa deslizável com o dedo (scroll-snap nativo, o cartão seguinte
 * espreita). A partir do ponto de quebra: as classes de `className` (normalmente uma grelha).
 * Os filhos usam SWIPE_ITEM / SWIPE_ITEM_LG.
 */
export function SwipeRow({
  children,
  className,
  as: As = 'div',
  label,
  ate = 'md',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'ul'
  label?: string
  /** até que ponto de quebra é faixa deslizável */
  ate?: 'md' | 'lg'
}) {
  const faixa = useMediaQuery(ate === 'md' ? '(max-width: 767.98px)' : '(max-width: 1023.98px)')
  return (
    <As aria-label={label} data-lenis-prevent-horizontal={faixa ? '' : undefined} className={cn(SWIPE_BASE, SWIPE_FIM[ate], className)}>
      {children}
    </As>
  )
}

/** Título de secção (h2) com uma frase de apoio. */
export function SectionTitle({
  id,
  title,
  subtitle,
  align = 'center',
  size = 'lg',
  className,
}: {
  id?: string
  title: ReactNode
  subtitle?: ReactNode
  align?: 'center' | 'left'
  size?: 'lg' | 'md'
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-4', align === 'center' && 'mx-auto items-center text-center', className)}>
      <h2 id={id} className={cn('font-semibold text-ink', size === 'lg' ? 'headline max-w-[18ch]' : 'text-3xl sm:text-4xl')}>
        {title}
      </h2>
      {subtitle && (
        <p className={cn('text-ink-mute', size === 'lg' ? 'max-w-[40ch] text-xl sm:text-2xl' : 'max-w-[56ch] text-lg sm:text-xl')}>{subtitle}</p>
      )}
    </div>
  )
}

const FONTES = {
  ss: { href: 'https://www.seg-social.pt', label: 'seg-social.pt' },
  financas: { href: 'https://www.portaldasfinancas.gov.pt', label: 'portaldasfinancas.gov.pt' },
} as const

/** Ligação discreta para confirmar valores e regras na fonte oficial. */
export function Confirme({ fonte, className }: { fonte: keyof typeof FONTES; className?: string }) {
  const f = FONTES[fonte]
  return (
    <p className={cn('text-sm text-ink-mute', className)}>
      Confirme em <ExternalLink href={f.href}>{f.label}</ExternalLink>
    </p>
  )
}
