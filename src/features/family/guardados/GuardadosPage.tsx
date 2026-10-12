import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Columns3, Heart, HeartOff, Map, X } from 'lucide-react'
import type { Disponibilidade } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Checkbox, Switch } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { LarCard } from '@/components/lar/LarCard'
import { setAlerta, toggleFavorito, useFavoritos, useMinhasCandidaturas } from '@/lib/store'
import { disponibilidade } from '@/lib/forecast'
import { distanceKm } from '@/lib/geo'
import { useDocumentTitle } from '@/lib/hooks'
import { tempoRelativo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useLarIndex, usePerfisOrdenados, pesquisaUrl } from '../shared/data'
import { isAtiva } from '../shared/estado'
import { EstadoBadge } from '../shared/ui'
import { nomeCurto } from '../shared/text'
import { CompareTable } from './CompareTable'

const MAX_COMPARAR = 3

const DISP: { k: Disponibilidade; label: string; bar: string; dot: string }[] = [
  { k: 'disponivel', label: 'com vaga agora', bar: 'bg-leaf-500', dot: 'bg-leaf-500' },
  { k: 'breve', label: 'vaga prevista em breve', bar: 'bg-sun-400', dot: 'bg-sun-400' },
  { k: 'espera', label: 'em lista de espera', bar: 'bg-dusk-500', dot: 'bg-dusk-500' },
]

export default function GuardadosPage() {
  useDocumentTitle('Instituições guardadas')
  const favoritos = useFavoritos()
  const idx = useLarIndex()
  const cands = useMinhasCandidaturas()
  const { principal } = usePerfisOrdenados()
  const [comparar, setComparar] = useState(false)
  const [sel, setSel] = useState<string[]>([])

  const itens = useMemo(
    () =>
      favoritos
        .map((f) => ({ f, lar: idx.get(f.larId)! }))
        .filter((x) => x.lar)
        .map((x) => ({ ...x, disp: disponibilidade(x.lar) }))
        .sort((a, b) => b.f.criadoEm.localeCompare(a.f.criadoEm)),
    [favoritos, idx],
  )
  const contagem = Object.fromEntries(DISP.map((d) => [d.k, itens.filter((x) => x.disp === d.k).length])) as Record<Disponibilidade, number>
  const comAlerta = itens.filter((x) => x.f.alerta).length
  const comVaga = itens.filter((x) => x.disp === 'disponivel')
  const selecionados = sel.map((id) => idx.get(id)).filter((l) => l != null)

  const entrarComparacao = () => {
    setComparar(true)
    setSel(itens.slice(0, MAX_COMPARAR).map((x) => x.lar.id))
  }
  const alternar = (id: string, on: boolean) => setSel((s) => (on ? [...s, id].slice(0, MAX_COMPARAR) : s.filter((x) => x !== id)))
  const remover = (id: string, nome: string) => {
    toggleFavorito(id)
    setSel((s) => s.filter((x) => x !== id))
    toast.info('Removida dos guardados', `${nome} deixou de estar na sua lista e não vai receber avisos de vaga.`)
  }

  if (itens.length === 0) {
    return (
      <EmptyState
        icon={<Heart />}
        title="Ainda não guardou instituições"
        text="No mapa de vagas ou na ficha de cada lar, toque no coração para guardar. Aqui pode compará-las lado a lado e receber um aviso quando abrir vaga."
        action={
          <ButtonLink to={principal ? pesquisaUrl(principal) : '/pesquisa'} icon={<Map aria-hidden className="size-5" />}>
            Abrir o mapa de vagas
          </ButtonLink>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {/* resumo */}
      <section aria-labelledby="guardados-resumo" className="rounded-[1.75rem] border border-line bg-white p-5 shadow-card sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-xl">
            <h2 id="guardados-resumo" className="font-display text-2xl leading-snug font-semibold sm:text-3xl">
              {itens.length === 1 ? '1 instituição guardada' : `${itens.length} instituições guardadas`}
              {comVaga.length > 0 ? (
                <>
                  , <em>{comVaga.length === 1 ? '1 com vaga agora' : `${comVaga.length} com vaga agora`}</em>.
                </>
              ) : (
                '.'
              )}
            </h2>
            <p className="mt-2 text-ink-soft" aria-live="polite">
              {comAlerta === itens.length
                ? 'Avisamos assim que abrir vaga em qualquer uma delas.'
                : comAlerta === 0
                  ? 'Os avisos de vaga estão desligados em todas.'
                  : `Avisos de vaga ligados em ${comAlerta} de ${itens.length}.`}
              {comVaga.length > 0 && (
                <>
                  {' '}
                  Com vaga:{' '}
                  {comVaga.map((x, i) => (
                    <span key={x.lar.id}>
                      {i > 0 && ', '}
                      <Link to={`/lar/${x.lar.id}`} className="link">
                        {x.lar.nome}
                      </Link>
                    </span>
                  ))}
                  .
                </>
              )}
            </p>
          </div>
          {itens.length >= 2 &&
            (comparar ? (
              <Button variant="secondary" icon={<X aria-hidden className="size-5" />} onClick={() => setComparar(false)}>
                Fechar comparação
              </Button>
            ) : (
              <Button icon={<Columns3 aria-hidden className="size-5" />} onClick={entrarComparacao}>
                Comparar lado a lado
              </Button>
            ))}
        </div>

        {/* barra de disponibilidade — cor + texto */}
        <div className="mt-5">
          <div aria-hidden className="flex h-3 overflow-hidden rounded-full bg-sand-deep">
            {DISP.map((d) =>
              contagem[d.k] ? <span key={d.k} className={cn('h-full border-r-2 border-white last:border-r-0', d.bar)} style={{ width: `${(contagem[d.k] / itens.length) * 100}%` }} /> : null,
            )}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {DISP.map((d) => (
              <li key={d.k} className="inline-flex items-center gap-2">
                <span aria-hidden className={cn('size-2.5 rounded-full', d.dot)} />
                <strong className="tabular">{contagem[d.k]}</strong> {d.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* comparação */}
      {comparar && (
        <section aria-labelledby="comparar-titulo" className="animate-fade-up">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Comparar</p>
              <h2 id="comparar-titulo" className="font-display text-2xl font-semibold sm:text-3xl">
                Lado a lado
                {principal && (
                  <>
                    , a pensar {principal.genero === 'F' ? 'na' : principal.genero === 'M' ? 'no' : 'em'} <em>{nomeCurto(principal.nome)}</em>
                  </>
                )}
              </h2>
            </div>
            <p className="text-sm text-ink-soft" aria-live="polite">
              {selecionados.length} de {MAX_COMPARAR} escolhidas · marque ou desmarque nos cartões abaixo
            </p>
          </div>
          {selecionados.length >= 2 ? (
            <CompareTable lares={selecionados} perfil={principal} pedidos={cands} />
          ) : (
            <p className="rounded-3xl border-2 border-dashed border-line-strong bg-white/60 p-6 text-ink-soft">
              Escolha pelo menos duas instituições nos cartões abaixo (“Incluir na comparação”).
            </p>
          )}
        </section>
      )}

      {/* grelha */}
      <section aria-labelledby="guardados-lista">
        <h2 id="guardados-lista" className="sr-only">
          Lista de instituições guardadas
        </h2>
        <ul className="grid gap-x-6 gap-y-8 md:grid-cols-2">
          {itens.map(({ f, lar }) => {
            const pedido = cands.find((c) => c.larId === lar.id && isAtiva(c))
            const escolhido = sel.includes(lar.id)
            return (
              <li key={lar.id} className="flex flex-col">
                <LarCard lar={lar} distanciaKm={principal ? distanceKm(principal.local, lar) : undefined} className={cn('z-[1] flex-1', comparar && escolhido && 'ring-2 ring-pine-600')} />
                <div className="-mt-6 rounded-b-3xl border border-t-0 border-line bg-sand px-5 pt-9 pb-3">
                  {pedido && (
                    <p className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                      <EstadoBadge estado={pedido.estado} />
                      <Link to={`/familia/pedidos#pedido-${pedido.id}`} className="link inline-flex min-h-11 items-center">
                        Ver o seu pedido
                      </Link>
                    </p>
                  )}
                  <Switch
                    checked={f.alerta}
                    onChange={(v) => {
                      setAlerta(lar.id, v)
                      toast.success(v ? 'Aviso de vaga ligado' : 'Aviso de vaga desligado', v ? `Avisamos assim que ${lar.nome} abrir vaga.` : undefined)
                    }}
                    label="Avisar-me quando houver vaga"
                    description={f.alerta ? 'Notificação no painel e no sino.' : 'Sem avisos para esta instituição.'}
                  />
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-line-strong pt-1">
                    {comparar ? (
                      <Checkbox
                        label="Incluir na comparação"
                        checked={escolhido}
                        disabled={!escolhido && sel.length >= MAX_COMPARAR}
                        onChange={(e) => alternar(lar.id, e.target.checked)}
                      />
                    ) : (
                      <span className="text-sm text-ink-soft">Guardada {tempoRelativo(f.criadoEm)}</span>
                    )}
                    <Button variant="ghost" icon={<HeartOff aria-hidden className="size-4.5" />} onClick={() => remover(lar.id, lar.nome)} aria-label={`Remover ${lar.nome} dos guardados`}>
                      Remover
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
