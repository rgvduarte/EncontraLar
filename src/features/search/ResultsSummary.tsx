import { useId } from 'react'
import { Link } from 'react-router'
import { X } from 'lucide-react'
import type { TipoResposta } from '@/types'
import { AvisoAcesso } from '@/components/acesso'
import { CUIDADO_LABEL, GRAU_LABEL, NATUREZA_LABEL } from '@/lib/labels'
import { euro, num } from '@/lib/format'
import { cn } from '@/lib/cn'
import { DispDot, QuietSelect } from './Chips'
import { refTitulo } from './focoTitulo'
import { agregadoVisivel, faixaDoOrcamento, ROTULO_FAIXA, type Ignorados } from './gratis'
import { useNumeroAnimado, usePresenca } from './motion'
import type { SearchModel } from './useSearch'
import {
  centroDe,
  contarTodosFiltros,
  FILTROS_VAZIOS,
  noDistrito,
  ORDEM_LABEL,
  ORDENS,
  pertoDe,
  TIPO_CURTO,
  VAGA_LABEL,
  type SearchState,
} from './searchState'

const NOME_TIPO: Record<TipoResposta, string> = {
  erpi: 'Lares',
  residencia: 'Residências seniores',
  centro_dia: 'Centros de dia',
}

/** Título da página (h1 e separador do navegador) — diz em palavras o que se está a ver. */
export function tituloPesquisa(s: SearchState): string {
  const quem = s.tipos.length === 1 ? NOME_TIPO[s.tipos[0]!] : 'Lares e residências'
  switch (s.local.tipo) {
    case 'lugar':
      return `${quem} ${pertoDe(s.local.lugar.label)}`
    case 'coords':
      return `${quem} perto de si`
    case 'distrito':
      return `${quem} ${noDistrito(s.local.distrito)}`
    case 'zona':
      return `${quem} nesta zona do mapa`
    default:
      return `${quem} em todo o país`
  }
}

/** Onde aparece cada filtro: na barra (pílulas visíveis) ou só dentro de painéis. */
type Grupo = 'vaga' | 'tipo' | 'max' | 'mais'

interface Pilula {
  id: string
  grupo: Grupo
  texto: string
  patch: Partial<SearchState>
}

/** Versão grátis (`completo = false`): o orçamento aparece como faixa ("Até 1.000 €"). */
export function pilulasAtivas(s: SearchState, completo = true): Pilula[] {
  const out: Pilula[] = []
  if (s.vaga) out.push({ id: 'vaga', grupo: 'vaga', texto: VAGA_LABEL[s.vaga], patch: { vaga: null } })
  for (const t of s.tipos) out.push({ id: `t-${t}`, grupo: 'tipo', texto: TIPO_CURTO[t], patch: { tipos: s.tipos.filter((x) => x !== t) } })
  const faixa = faixaDoOrcamento(s.max)
  if (s.max != null && completo) out.push({ id: 'max', grupo: 'max', texto: `Até ${euro(s.max)}`, patch: { max: null } })
  else if (faixa != null) out.push({ id: 'max', grupo: 'max', texto: ROTULO_FAIXA[faixa], patch: { max: null } })
  if (s.grau) out.push({ id: 'grau', grupo: 'mais', texto: GRAU_LABEL[s.grau], patch: { grau: null } })
  for (const c of s.cuidados) out.push({ id: `c-${c}`, grupo: 'mais', texto: CUIDADO_LABEL[c], patch: { cuidados: s.cuidados.filter((x) => x !== c) } })
  if (s.ss) out.push({ id: 'ss', grupo: 'mais', texto: 'Acordo com a Segurança Social', patch: { ss: false } })
  for (const n of s.naturezas) out.push({ id: `n-${n}`, grupo: 'mais', texto: NATUREZA_LABEL[n], patch: { naturezas: s.naturezas.filter((x) => x !== n) } })
  if (s.q) out.push({ id: 'q', grupo: 'mais', texto: `Nome com «${s.q}»`, patch: { q: '' } })
  return out
}

interface Props {
  model: SearchModel
  /** desktop: Tipo e Orçamento já aparecem na barra */
  desktop: boolean
}

const chavePilula = (p: Pilula) => p.id

const VAGA_MAIS_CEDO = `«${ORDEM_LABEL.disponibilidade}»`

/** Versão grátis: o que o endereço pedia (vaga, ordem por vaga) e porque não se aplica. */
function textoIgnorados({ vaga, ordem }: Ignorados): string {
  if (vaga && ordem) return `«${VAGA_LABEL[vaga]}» e ${VAGA_MAIS_CEDO} estão disponíveis com o Acesso Família. Mostramos todas, por relevância.`
  if (vaga) return `«${VAGA_LABEL[vaga]}» está disponível com o Acesso Família. Mostramos todas as instituições.`
  return `${VAGA_MAIS_CEDO} está disponível com o Acesso Família. Mostramos por relevância.`
}

/** Número que desliza entre valores quando os filtros mudam (visual; o leitor de ecrã lê o valor final). */
function Contagem({ n }: { n: number }) {
  const v = useNumeroAnimado(n)
  return <span className="font-medium text-ink tabular">{num(v)}</span>
}

/**
 * Cabeçalho calmo da lista: título, "N instituições · M com vaga agora", ordenação e filtros removíveis.
 * Versão grátis: o mesmo total agregado (quantas, nunca quais; só a partir de 5 resultados), um convite numa linha,
 * e «Vaga mais cedo» fechada na ordenação (escolhê-la abre o convite e a ordem fica como estava).
 */
export function ResultsSummary({ model, desktop }: Props) {
  const { state, resultados, comVaga, update, completo, ignorados, pedirAcesso } = model
  const n = resultados.length
  // versão grátis com poucos resultados: "1 com vaga agora" em 1 resultado diria qual
  const agregado = n > 0 && (completo || agregadoVisivel(n))
  const centro = centroDe(state.local)
  const visiveis: Grupo[] = desktop ? ['mais'] : ['tipo', 'max', 'mais']
  const pilulas = pilulasAtivas(state, completo).filter((p) => visiveis.includes(p.grupo))
  const presentes = usePresenca(pilulas, chavePilula)
  const total = contarTodosFiltros(state) + (state.q ? 1 : 0)
  const titulo = tituloPesquisa(state)
  const resumo = `${num(n)} ${n === 1 ? 'instituição' : 'instituições'}${agregado ? `, ${num(comVaga)} com vaga agora` : ''}`
  const ordemFechada = useId()

  return (
    <header className="px-5 pt-6 sm:px-6 lg:pt-8 xl:px-8">
      {/* o título muda com a zona/tipo: troca suave (chave = texto) */}
      {/* tabIndex -1: recebe o foco depois de escolher um lugar num ecrã tátil (focoTitulo) */}
      <h1
        key={titulo}
        ref={refTitulo}
        tabIndex={-1}
        data-titulo-pesquisa
        className="el-swap text-[1.75rem] leading-tight font-semibold tracking-tight text-ink sm:text-2xl"
      >
        {titulo}
      </h1>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4">
        <p aria-hidden className="text-base text-ink-mute">
          <Contagem n={n} /> {n === 1 ? 'instituição' : 'instituições'}
          {agregado && (
            <>
              <span> · </span>
              <span className="inline-flex items-baseline gap-1.5">
                <DispDot disp="disponivel" className="size-2.5 self-center" />
                <span>
                  <Contagem n={comVaga} /> com vaga agora
                </span>
              </span>
            </>
          )}
        </p>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {resumo}
        </p>
        {/* versão grátis: o convite fica logo a seguir ao total; um endereço com filtro por vaga explica o que ficou de fora */}
        {!completo && ignorados ? (
          <div className="mt-2 mb-1 basis-full rounded-[1.25rem] bg-sand px-4 sm:px-5">
            <AvisoAcesso texto={textoIgnorados(ignorados)} className="text-ink-soft" />
          </div>
        ) : (
          !completo &&
          n > 0 && (
            <AvisoAcesso
              texto={agregado && comVaga === 0 ? 'Saber quando deve abrir vaga e receber alertas' : 'Saber quais têm vaga e quantos lugares'}
              className="-my-1 basis-full"
            />
          )
        )}
        {n > 1 && (
          <div className="-mx-3 flex items-center gap-x-1 sm:mx-0 sm:-mr-3">
            <QuietSelect
              label="Ordenar"
              value={state.ordem}
              aria-describedby={completo ? undefined : ordemFechada}
              onChange={(e) => {
                const ordem = e.target.value as SearchState['ordem']
                // versão grátis: «Vaga mais cedo» abre o convite; o <select> controlado volta à ordem atual
                if (!completo && ordem === 'disponibilidade') pedirAcesso({ ordem })
                else update({ ordem })
              }}
            >
              {ORDENS.filter((o) => (o !== 'distancia' || centro) && (completo || o !== 'disponibilidade')).map((o) => (
                <option key={o} value={o}>
                  {ORDEM_LABEL[o]}
                </option>
              ))}
              {/* fechada, mas à vista (no fim, para as setas não passarem por ela a caminho das outras) */}
              {!completo && (
                <optgroup label="Com o Acesso Família">
                  <option value="disponibilidade">{ORDEM_LABEL.disponibilidade}</option>
                </optgroup>
              )}
            </QuietSelect>
            {!completo && (
              <span id={ordemFechada} hidden>
                {VAGA_MAIS_CEDO} está disponível com o Acesso Família.
              </span>
            )}
            <Link
              to="/como-ordenamos"
              className="inline-flex min-h-12 shrink-0 items-center rounded-full px-3 text-sm whitespace-nowrap text-terra-600 transition-colors hover:bg-sand hover:underline"
            >
              Como ordenamos?
            </Link>
          </div>
        )}
      </div>

      {(presentes.length > 0 || (total >= 2 && n > 0)) && (
        // telemóvel: uma só linha deslizante (com encaixe) de ponta a ponta; desktop: quebra de linha
        <div
          data-lenis-prevent-horizontal={desktop ? undefined : ''}
          className={cn(
            'mt-1 flex items-center gap-x-2',
            desktop
              ? 'flex-wrap'
              : '-mx-5 snap-x snap-mandatory scroll-px-5 overflow-x-auto overflow-y-hidden overscroll-x-contain overscroll-y-auto! px-5 [mask-image:linear-gradient(to_right,transparent,#000_1.25rem,#000_calc(100%-2rem),transparent)] [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 [&>*]:snap-start',
          )}
        >
          {pilulas.length > 0 && <span className="sr-only">Filtros ativos:</span>}
          {presentes.map(({ key, item: p, saindo }) => (
            <button
              key={key}
              type="button"
              onClick={() => update(p.patch)}
              aria-label={`Retirar filtro: ${p.texto}`}
              aria-hidden={saindo || undefined}
              tabIndex={saindo ? -1 : undefined}
              data-saindo={saindo || undefined}
              className="el-pill group inline-flex min-h-12 items-center rounded-full"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sand py-1.5 pr-2.5 pl-3.5 text-sm text-ink transition-[background-color,scale] duration-200 group-hover:bg-sand-deep group-active:scale-[0.95]">
                <span className="max-w-[16rem] truncate">{p.texto}</span>
                <X aria-hidden className="size-4 text-ink-mute" />
              </span>
            </button>
          ))}
          {total >= 2 && n > 0 && (
            <button
              type="button"
              onClick={() => update({ ...FILTROS_VAZIOS })}
              className={cn('el-pill inline-flex min-h-12 items-center px-2 text-sm font-medium whitespace-nowrap text-terra-600 hover:underline', presentes.length === 0 && '-ml-2')}
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </header>
  )
}
