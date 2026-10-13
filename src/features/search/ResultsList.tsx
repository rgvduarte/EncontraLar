import { memo, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { LarCard } from '@/components/lar/LarCard'
import { Button } from '@/components/ui/Button'
import { num } from '@/lib/format'
import { dividir, type Entrada } from './filtering'
import { podeAnimar, useRevelarItens } from './motion'
import type { Ordem } from './searchState'

export const PAGINA = 20

export const cardDomId = (id: string) => `resultado-${id}`

/**
 * No telemóvel a capa fica mais baixa (2:1) para caberem mais resultados por ecrã.
 * Ao tocar no cartão (a ligação cobre-o todo) ele "afunda" ligeiramente — resposta tátil de app nativa.
 */
const CARTAO = 'max-sm:[&>div:first-child]:aspect-[2/1] has-[a:active]:scale-[0.985] has-[a:active]:duration-100'

interface Props {
  resultados: Entrada[]
  /** muda com os filtros/ordenação: a lista volta a entrar em cascata */
  geracao: string
  ordem: Ordem
  visiveis: number
  onMais: () => void
  /** destaque vindo do mapa (passar o rato / escolher marcador) */
  destaqueId: string | null
  onHover: (id: string | null) => void
  mostrarDistancia: boolean
  /** camada completa (Acesso Família); na versão grátis a lista é uma só, sem grupos por vaga (diriam quais têm) */
  completo: boolean
}

/** Lista de cartões horizontais, paginada de 20 em 20; separa "Com vaga agora" do resto quando ajuda. */
export const ResultsList = memo(function ResultsList({
  resultados,
  geracao,
  ordem,
  visiveis,
  onMais,
  destaqueId,
  onHover,
  mostrarDistancia,
  completo,
}: Props) {
  const parte = useMemo(() => resultados.slice(0, visiveis), [resultados, visiveis])
  const grupos = useMemo(() => (completo ? dividir(parte, resultados, ordem) : null), [completo, parte, resultados, ordem])
  const faltam = resultados.length - parte.length

  // cartões revelados ao entrar no ecrã, em cascata (ao abrir, ao mudar filtros, ao fazer scroll, "Mostrar mais")
  const [animar] = useState(podeAnimar)
  const raiz = useRef<HTMLDivElement>(null)
  useRevelarItens(raiz, [geracao, parte.length])

  const lista = (itens: Entrada[], h: 'h2' | 'h3') => (
    <ol className="flex flex-col gap-2">
      {itens.map((e) => (
        <li key={e.lar.id} id={cardDomId(e.lar.id)} data-item className="scroll-mt-[calc(4rem+var(--barra,0px)+1.5rem)]">
          <LarCard
            lar={e.lar}
            layout="horizontal"
            distanciaKm={mostrarDistancia ? e.distanciaKm : undefined}
            selected={destaqueId === e.lar.id}
            onHover={onHover}
            headingLevel={h}
            className={CARTAO}
          />
        </li>
      ))}
    </ol>
  )

  return (
    <div key={geracao} ref={raiz} data-revelar={animar ? '' : undefined} className="px-2 pt-4 sm:px-3 xl:px-5">
      {grupos
        ? grupos.map((g, i) => (
            <section key={g.id} aria-labelledby={`grupo-${g.id}`} className={i > 0 ? 'mt-12' : undefined}>
              <h2 id={`grupo-${g.id}`} data-item className="mb-2 px-3 text-lg font-semibold tracking-tight text-ink">
                {g.titulo}
                <span className="ml-2 font-normal text-ink-mute tabular">
                  {num(g.total)}
                  <span className="sr-only"> {g.total === 1 ? 'instituição' : 'instituições'}</span>
                </span>
              </h2>
              {lista(g.itens, 'h3')}
            </section>
          ))
        : lista(parte, 'h2')}

      {faltam > 0 && (
        <div className="mt-10 flex flex-col items-center gap-3 px-3 text-center">
          <p className="text-sm text-ink-mute tabular">
            {num(parte.length)} de {num(resultados.length)}
          </p>
          {/* telemóvel: largura total, ao alcance do polegar */}
          <Button variant="subtle" onClick={onMais} className="max-sm:w-full">
            Mostrar mais
          </Button>
        </div>
      )}
    </div>
  )
})

/** Nota final da lista: honestidade sobre os dados + assinatura discreta (a página não tem rodapé). */
export function NotaFinal() {
  return (
    <footer className="mx-5 mt-16 border-t border-line pt-6 pb-10 text-sm text-ink-mute sm:mx-6 xl:mx-8">
      <p className="max-w-[34rem]">
        Protótipo: instituições e vagas fictícias. As vagas são indicadas pelas próprias instituições e a previsão é uma estimativa, não uma
        garantia. Confirme por telefone antes de se deslocar.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-6">
        <Link to="/sobre#previsao" className="inline-flex min-h-12 items-center font-medium text-terra-600 hover:underline">
          Como calculamos a previsão
          <ChevronRight aria-hidden className="size-4" />
        </Link>
        <a href="https://www.buildity.pt" target="_blank" rel="noopener" className="inline-flex min-h-12 items-center text-xs text-ink-mute transition-colors hover:text-ink">
          by Buildity
        </a>
      </div>
    </footer>
  )
}
