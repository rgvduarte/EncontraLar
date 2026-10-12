import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Checkbox, Switch } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/misc'
import { Reveal } from '@/components/ui/Reveal'
import { toast } from '@/components/ui/Toast'
import { LarCard } from '@/components/lar/LarCard'
import { setAlerta, toggleFavorito, useFavoritos, useMinhasCandidaturas } from '@/lib/store'
import { vagasLivres } from '@/lib/forecast'
import { distanceKm } from '@/lib/geo'
import { useDocumentTitle } from '@/lib/hooks'
import { tempoRelativo } from '@/lib/format'
import { ESTADO_CANDIDATURA_LABEL } from '@/lib/labels'
import { useLarIndex, usePerfisOrdenados, pesquisaUrl } from '../shared/data'
import { isAtiva } from '../shared/estado'
import { MoreLink } from '../shared/ui'
import { CompareTable } from './CompareTable'

const MAX_COMPARAR = 3

export default function GuardadosPage() {
  useDocumentTitle('Guardados')
  const favoritos = useFavoritos()
  const idx = useLarIndex()
  const cands = useMinhasCandidaturas()
  const { principal } = usePerfisOrdenados()
  const [comparar, setComparar] = useState(false)
  const [sel, setSel] = useState<string[]>([])

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
    setComparar(true)
    setSel(itens.slice(0, MAX_COMPARAR).map((x) => x.lar.id))
  }
  const alternar = (id: string, on: boolean) => setSel((s) => (on ? [...s, id].slice(0, MAX_COMPARAR) : s.filter((x) => x !== id)))
  const remover = (id: string, nome: string) => {
    toggleFavorito(id)
    setSel((s) => s.filter((x) => x !== id))
    toast.info('Removida dos guardados', nome)
  }

  if (itens.length === 0) {
    return (
      <EmptyState
        title="Ainda não guardou instituições"
        text="No mapa de vagas ou na ficha de cada lar, toque no coração para guardar. Aqui compara-as e recebe um aviso quando abrir vaga."
        action={<ButtonLink to={pesquisa}>Abrir o mapa de vagas</ButtonLink>}
      />
    )
  }

  return (
    <div className="flex flex-col gap-14">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div aria-live="polite">
          <p className="text-2xl font-semibold sm:text-3xl">
            {itens.length === 1 ? '1 guardada' : `${itens.length} guardadas`}
            <span className="text-ink-mute"> · </span>
            <span className={comVaga > 0 ? 'text-leaf-700' : 'text-ink-mute'}>{comVaga} com vaga agora</span>
          </p>
          <p className="mt-1.5 text-ink-mute">
            {comAlerta === itens.length
              ? 'Avisamos assim que abrir vaga em qualquer uma.'
              : comAlerta === 0
                ? 'Avisos de vaga desligados.'
                : `Avisos de vaga ligados em ${comAlerta} de ${itens.length}.`}
          </p>
        </div>
        {itens.length >= 2 &&
          (comparar ? (
            <Button variant="subtle" onClick={() => setComparar(false)}>
              Fechar comparação
            </Button>
          ) : (
            <Button onClick={abrirComparacao}>Comparar</Button>
          ))}
      </div>

      {comparar && (
        <section aria-labelledby="comparar-titulo" className="animate-fade-up">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 id="comparar-titulo" className="text-2xl font-semibold sm:text-3xl">
              Lado a lado
            </h2>
            <p className="text-sm text-ink-mute" aria-live="polite">
              {selecionados.length} de {MAX_COMPARAR} escolhidas · marque “Comparar” em cada uma
            </p>
          </div>
          <div className="mt-8">
            {selecionados.length >= 2 ? (
              <CompareTable lares={selecionados} perfil={principal} pedidos={cands} />
            ) : (
              <p className="tile text-ink-mute">Escolha pelo menos duas instituições abaixo.</p>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="guardados-lista">
        <h2 id="guardados-lista" className="sr-only">
          Instituições guardadas
        </h2>
        <ul className="grid gap-x-6 gap-y-14 md:grid-cols-2 2xl:grid-cols-3">
          {itens.map(({ f, lar }, i) => {
            const pedido = cands.find((c) => c.larId === lar.id && isAtiva(c))
            const escolhido = sel.includes(lar.id)
            return (
              <Reveal as="li" key={lar.id} delay={Math.min(i, 5) * 60} className="flex flex-col">
                <LarCard lar={lar} distanciaKm={principal ? distanceKm(principal.local, lar) : undefined} />
                <div className="mt-3 flex flex-col px-1">
                  {pedido && (
                    <p className="text-sm text-ink-mute">
                      Pedido: {ESTADO_CANDIDATURA_LABEL[pedido.estado].toLowerCase()}
                      {' · '}
                      <Link to={`/familia/pedidos#pedido-${pedido.id}`} className="link">
                        Ver pedido
                      </Link>
                    </p>
                  )}
                  <Switch
                    checked={f.alerta}
                    onChange={(v) => {
                      setAlerta(lar.id, v)
                      toast.success(v ? 'Aviso de vaga ligado' : 'Aviso de vaga desligado', lar.nome)
                    }}
                    label="Avisar-me de vagas"
                    className="border-b border-line"
                  />
                  <div className="flex items-center justify-between gap-4">
                    {comparar ? (
                      <Checkbox
                        label="Comparar"
                        checked={escolhido}
                        disabled={!escolhido && sel.length >= MAX_COMPARAR}
                        onChange={(e) => alternar(lar.id, e.target.checked)}
                      />
                    ) : (
                      <span className="text-sm text-ink-mute">Guardada {tempoRelativo(f.criadoEm)}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => remover(lar.id, lar.nome)}
                      className="inline-flex min-h-12 items-center text-ink-mute hover:text-alert-700 hover:underline"
                      aria-label={`Remover ${lar.nome} dos guardados`}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </ul>
        <MoreLink to={pesquisa} className="mt-10">
          Guardar mais instituições no mapa
        </MoreLink>
      </section>
    </div>
  )
}
