import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { Lar } from '@/types'
import { VagasBoard } from '@/components/brand/VagasBoard'
import { Reveal } from './Entrada'
import { ScrollZoom } from '@/components/motion/ScrollZoom'
import { useLenis } from '@/components/motion/SmoothScroll'
import { useMediaQuery } from '@/lib/hooks'
import { cn } from '@/lib/cn'
import { escolherFichaPrecos, escolherPrevisao, exemploCompatibilidade, type HomeStats } from './homeData'
import { MatchCard, PrecosCard, PrevisaoCard, VerificacaoPeca } from './BentoPieces'
import { abrirPergunta } from './FaqSection'

// azul um pouco mais escuro sobre o cinza dos tiles (#0066cc sobre #f5f5f7 fica no limite de 4,5:1)
const linkClasses = 'link inline-flex min-h-12 items-center gap-0.5 self-start text-lg text-terra-700'

function Mais({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={linkClasses}>
      {children}
      <ChevronRight aria-hidden className="size-4.5" />
    </Link>
  )
}

function Tile({
  titulo,
  frase,
  acao,
  delay = 0,
  className,
  children,
}: {
  titulo: string
  frase: string
  acao: ReactNode
  delay?: number
  className?: string
  children: ReactNode
}) {
  return (
    <Reveal
      variant="scale"
      duration={1100}
      delay={delay}
      className={cn('flex min-w-0 flex-col rounded-[1.75rem] bg-sand p-6 sm:p-10', className)}
    >
      <h3 className="text-2xl font-semibold text-ink sm:text-3xl">{titulo}</h3>
      <p className="mt-2 max-w-md text-lg text-ink-mute">{frase}</p>
      <div className="mt-1">{acao}</div>
      <div className="mt-6 flex flex-1 flex-col justify-end sm:mt-8">{children}</div>
    </Reveal>
  )
}

/**
 * Clímax: a grelha "bento" monta-se. O tile da previsão (o diferenciador) é o tile-herói: aproxima-se com o
 * scroll (ScrollZoom) e as barras de cada mês enchem-se; os outros tiles entram a escalar, por colunas.
 * A lista "Atualizadas agora" roda sozinha (VagasBoard).
 */
export function Bento({ lares, stats, agora }: { lares: Lar[]; stats: HomeStats; agora: number }) {
  const previsao = useMemo(() => escolherPrevisao(lares), [lares])
  const ficha = useMemo(() => escolherFichaPrecos(lares), [lares])
  const exemplo = useMemo(() => exemploCompatibilidade(lares), [lares])
  const lenis = useLenis()
  // escalonar por coluna só quando há colunas (no telemóvel cada tile entra sozinho)
  const grelha = useMediaQuery('(min-width: 768px)')
  const d = (ms: number) => (grelha ? ms : 0)

  return (
    <section aria-labelledby="bento-titulo" className="py-20 sm:py-32 lg:py-40">
      <div className="container-page">
        <Reveal variant="blur" className="mx-auto max-w-3xl text-center">
          <h2 id="bento-titulo" className="headline">
            Tudo o que precisa para decidir.
          </h2>
          <p className="mt-5 text-xl text-ink-mute sm:text-2xl">Vagas, preços, previsão e compatibilidade, num só sítio.</p>
        </Reveal>

        {previsao && (
          <ScrollZoom from={0.9} radiusFrom={56} radiusTo={28} className="mt-12 bg-sand sm:mt-20">
            <div className="grid min-w-0 grid-cols-1 gap-6 p-6 sm:gap-10 sm:p-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-14 lg:p-14">
              <Reveal>
                <h3 className="text-[2rem] leading-[1.1] font-semibold text-ink sm:text-4xl lg:text-5xl">Previsão de vagas.</h3>
                <p className="mt-3 max-w-md text-lg text-ink-mute sm:text-xl">
                  Sem vaga hoje? Mostramos a probabilidade de abrir uma, mês a mês.
                </p>
                <div className="mt-1">
                  <Mais to="/sobre#previsao">Como calculamos</Mais>
                </div>
              </Reveal>
              <PrevisaoCard previsao={previsao} agora={agora} animar />
            </div>
          </ScrollZoom>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:mt-5 lg:grid-cols-3 lg:gap-5">
          <Tile
            titulo="Vagas em tempo real."
            frase="Cada instituição atualiza os seus lugares livres. Vê há quanto tempo foi."
            acao={<Mais to="/pesquisa?vaga=agora">Ver vagas no mapa</Mais>}
            className="md:col-span-2"
          >
            {/* ajustes locais ao componente partilhado: a contagem do cabeçalho está limitada a 15 (escondida)
                e o verde das vagas fica abaixo de 4,5:1 sobre branco (passa a leaf-700) */}
            <VagasBoard lares={lares} linhas={4} className="[&_.text-leaf-600]:text-leaf-700 [&_header>span]:hidden" />
          </Tile>

          {ficha && (
            <Tile
              titulo="Preços claros."
              frase="O preço de cada quarto, antes de telefonar."
              acao={<Mais to={`/lar/${ficha.id}`}>Ver a ficha</Mais>}
              delay={d(140)}
            >
              <PrecosCard lar={ficha} />
            </Tile>
          )}

          <Tile
            titulo="Instituições verificadas."
            frase="Confirmamos a licença e visitamos as instalações."
            acao={
              <button type="button" onClick={() => abrirPergunta('faq-vaga-real', lenis)} className={linkClasses}>
                Como verificamos
                <ChevronRight aria-hidden className="size-4.5" />
              </button>
            }
          >
            <VerificacaoPeca verificadas={stats.verificadas} total={stats.total} />
          </Tile>

          {exemplo && (
            <Reveal
              variant="scale"
              duration={1100}
              delay={d(140)}
              className="grid min-w-0 grid-cols-1 gap-6 rounded-[1.75rem] bg-sand p-6 sm:gap-8 sm:p-10 md:col-span-1 lg:col-span-2 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] lg:items-center lg:gap-8"
            >
              <div>
                <h3 className="text-2xl font-semibold text-ink sm:text-3xl">Compatível com o perfil.</h3>
                <p className="mt-2 max-w-md text-lg text-ink-mute">
                  Diga-nos do que a pessoa precisa. Ordenamos os lares pelo que importa, e explicamos porquê.
                </p>
                <div className="mt-1">
                  <Mais to="/encontrar">Ajuda-me a escolher</Mais>
                </div>
              </div>
              <div className="min-w-0">
                <MatchCard exemplo={exemplo} />
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  )
}
