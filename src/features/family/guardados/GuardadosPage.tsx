import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, Lock } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { LarCard } from '@/components/lar/LarCard'
import { AcessoNecessarioModal, AvisoAcesso } from '@/components/acesso'
import { setAlerta, toggleFavorito, useAcesso, useFavoritos, useMinhasCandidaturas } from '@/lib/store'
import { vagasLivres } from '@/lib/forecast'
import { distanceKm } from '@/lib/geo'
import { useDocumentTitle } from '@/lib/hooks'
import { tempoRelativo } from '@/lib/format'
import { ESTADO_CANDIDATURA_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { useLarIndex, usePerfisOrdenados, pesquisaUrl } from '../shared/data'
import { diaMes, isAtiva } from '../shared/estado'
import { MoreLink } from '../shared/ui'
import { Tween, sairEDepois, useMountAnimation, useStagger } from '../shared/motion'
import { CompareTable } from './CompareTable'

const MAX_COMPARAR = 3

/** Secção de comparação: entra a subir ao abrir. */
function Comparacao({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  useMountAnimation(ref, [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 600 })
  return (
    <section ref={ref} aria-labelledby="comparar-titulo">
      {children}
    </section>
  )
}

export default function GuardadosPage() {
  useDocumentTitle('Guardados')
  const favoritos = useFavoritos()
  const idx = useLarIndex()
  const cands = useMinhasCandidaturas()
  const { principal } = usePerfisOrdenados()
  // guardar é grátis; a comparação e os avisos de vaga são do Acesso Família (na versão grátis abrem a explicação)
  const { completo } = useAcesso()
  // a ação fica guardada depois de fechar, para o texto não mudar durante a animação de saída
  const [acessoModal, setAcessoModalState] = useState<{ open: boolean; acao: 'comparar' | 'alerta' }>({ open: false, acao: 'comparar' })
  const setAcessoModal = (acao: 'comparar' | 'alerta') => setAcessoModalState({ open: true, acao })
  const [comparar, setComparar] = useState(false)
  // só com o Acesso Família (se o passe terminar com a comparação aberta, a tabela de preços sai do ecrã)
  const comparando = comparar && completo
  const [sel, setSel] = useState<string[]>([])
  const [ul, item] = useStagger<HTMLUListElement>('up', 80)
  const cartoes = useRef<Record<string, HTMLLIElement | null>>({})

  const itens = useMemo(
    () =>
      favoritos
        .flatMap((f) => {
          const lar = idx.get(f.larId)
          return lar ? [{ f, lar }] : []
        })
        .sort((a, b) => b.f.criadoEm.localeCompare(a.f.criadoEm)),
    [favoritos, idx],
  )
  const comVaga = itens.filter((x) => vagasLivres(x.lar) > 0).length
  const comAlerta = itens.filter((x) => x.f.alerta).length
  const selecionados = sel.flatMap((id) => {
    const l = idx.get(id)
    return l ? [l] : []
  })
  const pesquisa = principal ? pesquisaUrl(principal) : '/pesquisa'

  const abrirComparacao = () => {
    if (!completo) return setAcessoModal('comparar')
    setComparar(true)
    setSel(itens.slice(0, MAX_COMPARAR).map((x) => x.lar.id))
  }
  const alternar = (id: string, on: boolean) => setSel((s) => (on ? [...s, id].slice(0, MAX_COMPARAR) : s.filter((x) => x !== id)))
  const remover = (id: string, nome: string) => {
    // o cartão encolhe e desvanece antes de sair da lista
    sairEDepois(cartoes.current[id], () => {
      toggleFavorito(id)
      setSel((s) => s.filter((x) => x !== id))
      toast.info('Removida dos guardados', nome)
    })
  }

  if (itens.length === 0) {
    return (
      <EmptyState
        title="Ainda não guardou instituições"
        text={
          completo
            ? 'No mapa de vagas ou na ficha de cada lar, toque no coração para guardar. Aqui compara-as e recebe um aviso quando abrir vaga.'
            : 'No mapa de vagas ou na ficha de cada lar, toque no coração para guardar. Ficam aqui, sempre à mão.'
        }
        action={<ButtonLink to={pesquisa}>Abrir o mapa de vagas</ButtonLink>}
      />
    )
  }

  return (
    <div className="flex flex-col gap-14">
      <div className="flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        {completo ? (
          <div aria-live="polite">
            <p className="text-2xl font-semibold sm:text-3xl">
              <Tween value={itens.length} fromZero duration={900} /> {itens.length === 1 ? 'guardada' : 'guardadas'}
              <span className="text-ink-mute"> · </span>
              <span className={comVaga > 0 ? 'text-leaf-700' : 'text-ink-mute'}>
                <Tween value={comVaga} fromZero duration={900} /> com vaga agora
              </span>
            </p>
            <p className="mt-1.5 text-ink-mute">
              {comAlerta === itens.length
                ? 'Avisamos assim que abrir vaga em qualquer uma.'
                : comAlerta === 0
                  ? 'Avisos de vaga desligados.'
                  : `Avisos de vaga ligados em ${comAlerta} de ${itens.length}.`}
            </p>
          </div>
        ) : (
          // versão grátis: quantas guardou, nunca quais têm vaga (numa lista curta, o número diria quais)
          <div aria-live="polite">
            <p className="text-2xl font-semibold sm:text-3xl">
              <Tween value={itens.length} fromZero duration={900} /> {itens.length === 1 ? 'guardada' : 'guardadas'}
            </p>
            <AvisoAcesso
              texto="Os avisos de vaga e a comparação lado a lado estão disponíveis com o Acesso Família."
              voltar="/familia/guardados"
              className="mt-1.5"
            />
          </div>
        )}
        {itens.length >= 2 &&
          (comparando ? (
            <Button variant="subtle" className="w-full sm:w-auto" onClick={() => setComparar(false)}>
              Fechar comparação
            </Button>
          ) : completo ? (
            <Button className="w-full sm:w-auto" onClick={abrirComparacao}>
              Comparar
            </Button>
          ) : (
            // versão grátis: o cadeado diz logo que é do Acesso Família; tocar explica, sem surpresas
            <Button variant="subtle" icon={<Lock aria-hidden />} className="w-full sm:w-auto" onClick={abrirComparacao}>
              Comparar<span className="sr-only"> (disponível com o Acesso Família)</span>
            </Button>
          ))}
      </div>

      {comparando && (
        <Comparacao>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 id="comparar-titulo" className="text-2xl font-semibold sm:text-3xl">
              Lado a lado
            </h2>
            <p className="text-sm text-ink-mute" aria-live="polite">
              {selecionados.length} de {MAX_COMPARAR} escolhidas
            </p>
          </div>

          {/* escolher o que comparar, junto da comparação (faixa deslizável no telemóvel) */}
          <ul
            aria-label="Escolher instituições para comparar"
            data-lenis-prevent-horizontal
            className="relative -mx-5 mt-5 flex snap-x scroll-px-5 gap-2 overflow-x-auto overscroll-x-contain overscroll-y-auto! px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
          >
            {itens.map(({ lar }) => {
              const escolhido = sel.includes(lar.id)
              const bloqueado = !escolhido && sel.length >= MAX_COMPARAR
              return (
                <li key={lar.id} className="shrink-0 snap-start">
                  <button
                    type="button"
                    aria-pressed={escolhido}
                    disabled={bloqueado}
                    onClick={() => alternar(lar.id, !escolhido)}
                    className={cn(
                      'inline-flex min-h-12 max-w-[17rem] items-center gap-2 rounded-full px-5 font-medium transition-[background-color,color,scale] duration-200 active:scale-[0.97]',
                      escolhido ? 'bg-ink text-white' : 'bg-sand text-ink hover:bg-sand-deep',
                      bloqueado && 'cursor-not-allowed opacity-45 active:scale-100',
                    )}
                  >
                    {escolhido && <Check aria-hidden strokeWidth={2.5} className="-ml-1 size-4 shrink-0 motion-safe:animate-[pop-in_.3s_cubic-bezier(.16,1,.3,1)_both]" />}
                    <span className="truncate">{lar.nome}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="mt-8">
            {selecionados.length >= 2 ? (
              <CompareTable lares={selecionados} perfil={principal} pedidos={cands} />
            ) : (
              <p className="tile text-ink-mute">Escolha pelo menos duas instituições.</p>
            )}
          </div>
        </Comparacao>
      )}

      <section aria-labelledby="guardados-lista">
        <h2 id="guardados-lista" className="sr-only">
          Instituições guardadas
        </h2>
        <ul ref={ul} className="grid gap-x-6 gap-y-12 md:grid-cols-2 md:gap-y-14 2xl:grid-cols-3">
          {itens.map(({ f, lar }, i) => {
            const pedido = cands.find((c) => c.larId === lar.id && isAtiva(c))
            return (
              <li
                key={lar.id}
                ref={(el) => {
                  cartoes.current[lar.id] = el
                }}
                {...item(i, 'flex flex-col')}
              >
                <LarCard lar={lar} distanciaKm={principal ? distanceKm(principal.local, lar) : undefined} />
                <div className="mt-3 flex flex-col px-1">
                  {pedido && (
                    <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-mute">
                      {pedido.estado === 'admitida' && pedido.entrada
                        ? `Entrou a ${diaMes(pedido.entrada.data)}`
                        : `Pedido: ${ESTADO_CANDIDATURA_LABEL[pedido.estado].toLowerCase()}`}
                      <MoreLink to={`/familia/pedidos#pedido-${pedido.id}`}>Ver pedido</MoreLink>
                    </p>
                  )}
                  <Switch
                    // versão grátis: o aviso não está ativo (não se finge ligado) e tocar explica o Acesso Família
                    checked={completo && f.alerta}
                    onChange={(v) => {
                      if (!completo) return setAcessoModal('alerta')
                      setAlerta(lar.id, v)
                      toast.success(v ? 'Aviso de vaga ligado' : 'Aviso de vaga desligado', lar.nome)
                    }}
                    label="Avisar-me de vagas"
                    className="border-b border-line"
                  />
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-ink-mute">Guardada {tempoRelativo(f.criadoEm)}</span>
                    <button
                      type="button"
                      onClick={() => remover(lar.id, lar.nome)}
                      className="-mr-3 inline-flex min-h-12 items-center rounded-full px-3 text-ink-mute transition-colors hover:text-alert-700 hover:underline active:bg-sand"
                      aria-label={`Remover ${lar.nome} dos guardados`}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        <MoreLink to={pesquisa} className="mt-10">
          Guardar mais instituições no mapa
        </MoreLink>
      </section>

      {!completo && (
        <AcessoNecessarioModal
          open={acessoModal.open}
          onClose={() => setAcessoModalState((m) => ({ ...m, open: false }))}
          acao={acessoModal.acao}
          voltar="/familia/guardados"
        />
      )}
    </div>
  )
}
