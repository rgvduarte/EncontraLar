import { Fragment, useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { Lar } from '@/types'
import { SearchPill } from './SearchPill'
import { HeroMap } from './HeroMap'
import { entrada } from './coreografia'
import './home-motion.css'

/** Palavras que sobem uma a uma, desfocadas → nítidas. O texto real fica para o leitor de ecrã (sr-only). */
function Palavras({ texto, de, enfase }: { texto: string; de: number; enfase?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const palavras = texto.split(' ')

  // Com ênfase (<em> em gradiente), cada palavra é uma camada animada à parte e o background-clip:text do
  // <em> pai deixaria de as pintar. Por isso cada palavra tem o seu <em> com uma "fatia" do mesmo gradiente:
  // tamanho = largura da frase, posição = deslocamento da palavra — continua a ler-se como um só gradiente.
  useLayoutEffect(() => {
    const el = ref.current
    if (!enfase || !el) return
    const medir = () => {
      const ems = Array.from(el.querySelectorAll<HTMLElement>('em'))
      const caixas = ems.map((e) => e.getBoundingClientRect())
      const x0 = Math.min(...caixas.map((c) => c.left))
      const w = Math.max(...caixas.map((c) => c.right)) - x0
      ems.forEach((e, i) => {
        e.style.backgroundSize = `${w}px 100%`
        e.style.backgroundPosition = `${x0 - caixas[i]!.left}px 0`
      })
    }
    medir()
    // o ResizeObserver não dispara em caixas inline: observa o título; e volta a medir quando a Inter carregar
    const ro = new ResizeObserver(medir)
    ro.observe(el.closest('h1') ?? el)
    let vivo = true
    document.fonts?.ready.then(() => vivo && medir())
    return () => {
      vivo = false
      ro.disconnect()
    }
  }, [enfase])

  return (
    <span ref={ref}>
      {palavras.map((p, i) => (
        <Fragment key={i}>
          <span className="hm-in inline-block" style={entrada(120 + (de + i) * 85, 'hm-blur-up', 900)}>
            {enfase ? <em>{p}</em> : p}
          </span>
          {i < palavras.length - 1 && ' '}
        </Fragment>
      ))}
    </span>
  )
}

/**
 * Gancho: o título entra palavra a palavra, a pesquisa sobe a seguir e o mapa "acende-se" de norte para sul.
 * Tudo isto é a entrada da página (não depende do scroll); com movimento reduzido aparece logo no estado final.
 */
export function Hero({ lares, agora, comVaga, completo }: { lares: Lar[]; agora: number; comVaga: number; completo: boolean }) {
  return (
    <section aria-labelledby="home-titulo" className="overflow-x-clip">
      <div className="container-page flex flex-col items-center pt-12 pb-16 text-center sm:pt-24 sm:pb-24 lg:pt-28 lg:pb-28">
        <p className="eyebrow hm-in" style={entrada(0, 'hm-fade', 900)}>
          Lares e residências seniores em Portugal
        </p>
        <h1
          id="home-titulo"
          className="mt-4 text-[2.75rem] leading-[1.04] font-semibold text-ink min-[400px]:text-[2.875rem] sm:mt-5 sm:text-6xl lg:text-7xl"
        >
          <span className="sr-only">O lar certo. Com vaga real.</span>
          <span aria-hidden>
            <Palavras texto="O lar certo." de={0} />
            <br />
            <Palavras texto="Com vaga real." de={3} enfase />
          </span>
        </h1>
        <p className="hm-in mx-auto mt-5 max-w-2xl text-lg text-ink-mute sm:mt-6 sm:text-2xl" style={entrada(560, 'hm-rise', 900)}>
          Vagas atualizadas pelas próprias instituições e a previsão de quando abre a próxima.
        </p>

        <div className="hm-in relative z-20 mt-8 w-full sm:mt-12" style={entrada(700, 'hm-rise', 900)}>
          <SearchPill lares={lares} completo={completo} />
        </div>
        <p className="hm-in mt-4 text-ink-mute sm:mt-5" style={entrada(840, 'hm-fade', 900)}>
          Não sabe por onde começar?{' '}
          <Link to="/encontrar" className="link inline-flex min-h-12 items-center gap-0.5 whitespace-nowrap">
            Ajuda-me a escolher
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </p>

        <div className="mt-10 w-full sm:mt-20">
          <HeroMap lares={lares} agora={agora} comVaga={comVaga} completo={completo} />
        </div>
      </div>
    </section>
  )
}
