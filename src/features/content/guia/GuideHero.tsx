import { Link } from 'react-router'
import { ArrowRight, BookOpen, Clock3, Printer } from 'lucide-react'
import { calcadaStonesBg } from '@/components/brand/patterns'

interface Props {
  minutos: number | null
  onGo: (id: string) => void
}

/** Cabeçalho do guia: título editorial + "Se tem pressa" para quem chega em aflição. */
export function GuideHero({ minutos, onGo }: Props) {
  return (
    <section aria-labelledby="guia-titulo" className="container-page grid gap-12 pt-12 pb-14 sm:pt-16 lg:grid-cols-12 lg:gap-10 lg:pt-20 lg:pb-20">
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-7 lg:pr-6">
        <p className="eyebrow flex items-center gap-2">
          <BookOpen aria-hidden className="size-4" /> Guia para famílias
        </p>
        <h1 id="guia-titulo" className="text-[2.5rem] leading-[1.06] font-semibold text-ink sm:text-5xl lg:text-6xl">
          Escolher um lar com calma, <em>mesmo com pressa</em>.
        </h1>
        <p className="max-w-[56ch] text-lg leading-relaxed text-ink-soft sm:text-xl">
          Para quem está a decidir depois de uma queda, de um diagnóstico ou de uma alta hospitalar — e para quem quer planear com tempo. O que
          é cada resposta, o que observar na visita, que apoios existem e a quem ligar.
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-base text-ink-soft">
          {minutos != null && (
            <li className="flex items-center gap-2">
              <Clock3 aria-hidden className="size-5 text-pine-700" /> Cerca de {minutos} minutos de leitura · pode ler por partes
            </li>
          )}
          <li>
            <button type="button" onClick={() => onGo('visita')} className="link inline-flex min-h-12 items-center gap-2">
              <Printer aria-hidden className="size-5" /> Lista da visita para imprimir
            </button>
          </li>
        </ul>
      </div>

      <aside
        aria-labelledby="pressa-titulo"
        className="on-dark relative self-start overflow-hidden rounded-[1.75rem] bg-pine-900 p-6 text-pine-50 shadow-lift sm:p-8 lg:col-span-5"
        style={calcadaStonesBg('#ffffff', 0.035)}
      >
        <h2 id="pressa-titulo" className="text-3xl font-semibold text-white">
          Se tem <em>pressa</em>
        </h2>
        <ol className="mt-5 flex flex-col divide-y divide-white/10">
          <li className="flex flex-col gap-1.5 py-4">
            <p className="font-bold text-white">A alta hospitalar é nos próximos dias</p>
            <p className="text-base text-pine-200">Fale hoje com o serviço social do hospital e, em paralelo, veja onde há vaga já.</p>
            <Link to="/pesquisa?vaga=agora" className="mt-1 inline-flex min-h-12 items-center gap-2 font-bold text-sun-200 hover:text-white">
              Lares com vaga agora <ArrowRight aria-hidden className="size-5" />
            </Link>
          </li>
          <li className="flex flex-col gap-1.5 py-4">
            <p className="font-bold text-white">Não sabe por onde começar</p>
            <p className="text-base text-pine-200">Responda a algumas perguntas sobre a pessoa e sugerimos instituições compatíveis.</p>
            <Link to="/encontrar" className="mt-1 inline-flex min-h-12 items-center gap-2 font-bold text-sun-200 hover:text-white">
              Ajuda-me a escolher <ArrowRight aria-hidden className="size-5" />
            </Link>
          </li>
          <li className="flex flex-col gap-1.5 pt-4">
            <p className="font-bold text-white">O custo preocupa-o</p>
            <p className="text-base text-pine-200">Comparticipações, complementos e deduções — e onde se pedem.</p>
            <button type="button" onClick={() => onGo('apoios')} className="mt-1 inline-flex min-h-12 items-center gap-2 self-start font-bold text-sun-200 hover:text-white">
              Apoios e custos <ArrowRight aria-hidden className="size-5" />
            </button>
          </li>
        </ol>
      </aside>
    </section>
  )
}
