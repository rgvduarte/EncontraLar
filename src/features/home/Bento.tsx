import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { Lar } from '@/types'
import { VagasBoard } from '@/components/brand/VagasBoard'
import { Reveal } from '@/components/ui/Reveal'
import { useLenis } from '@/components/motion/SmoothScroll'
import { cn } from '@/lib/cn'
import { escolherFichaPrecos, escolherPrevisao, exemploCompatibilidade, type HomeStats } from './homeData'
import { MatchCard, PrecosCard, PrevisaoCard, VerificacaoPeca } from './BentoPieces'
import { abrirPergunta } from './FaqSection'

// azul um pouco mais escuro sobre o cinza dos tiles (#0071e3 sobre #f5f5f7 fica abaixo de 4,5:1)
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
    <Reveal delay={delay} className={cn('flex min-w-0 flex-col rounded-[1.75rem] bg-sand p-6 sm:p-10', className)}>
      <h3 className="text-2xl font-semibold text-ink sm:text-3xl">{titulo}</h3>
      <p className="mt-2 max-w-md text-lg text-ink-mute">{frase}</p>
      <div className="mt-1">{acao}</div>
      <div className="mt-6 flex flex-1 flex-col justify-end sm:mt-8">{children}</div>
    </Reveal>
  )
}

/** Grelha "bento": cada tile tem um título, uma frase e um pedaço de UI real. */
export function Bento({ lares, stats, agora }: { lares: Lar[]; stats: HomeStats; agora: number }) {
  const previsao = useMemo(() => escolherPrevisao(lares), [lares])
  const ficha = useMemo(() => escolherFichaPrecos(lares), [lares])
  const exemplo = useMemo(() => exemploCompatibilidade(lares), [lares])
  const lenis = useLenis()

  return (
    <section aria-labelledby="bento-titulo" className="py-24 sm:py-32 lg:py-40">
      <div className="container-page">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 id="bento-titulo" className="headline">
            Tudo o que precisa para decidir.
          </h2>
          <p className="mt-5 text-xl text-ink-mute sm:text-2xl">Vagas, preços, previsão e compatibilidade, num só sítio.</p>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-4 sm:mt-20 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
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
              delay={100}
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

          {previsao && (
            <Tile
              titulo="Previsão de vagas."
              frase="Sem vaga hoje? Mostramos a probabilidade de abrir uma, mês a mês."
              acao={<Mais to="/sobre#previsao">Como calculamos</Mais>}
              delay={100}
              className="md:col-span-2"
            >
              <PrevisaoCard previsao={previsao} agora={agora} />
            </Tile>
          )}

          {exemplo && (
            <Reveal className="grid min-w-0 grid-cols-1 gap-6 rounded-[1.75rem] bg-sand p-6 sm:gap-8 sm:p-10 md:col-span-2 lg:col-span-3 lg:grid-cols-2 lg:items-center lg:gap-16 lg:p-14">
              <div>
                <h3 className="text-2xl font-semibold text-ink sm:text-3xl">Compatível com o perfil.</h3>
                <p className="mt-2 max-w-md text-lg text-ink-mute">
                  Diga-nos do que a pessoa precisa. Ordenamos os lares pelo que importa, e explicamos porquê.
                </p>
                <div className="mt-1">
                  <Mais to="/encontrar">Ajuda-me a escolher</Mais>
                </div>
              </div>
              <div className="min-w-0 lg:w-full lg:max-w-md lg:justify-self-end">
                <MatchCard exemplo={exemplo} />
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  )
}
