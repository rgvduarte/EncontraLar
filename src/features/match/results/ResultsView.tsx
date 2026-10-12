import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Bookmark, Map as MapIcon, RotateCcw, SearchX, SlidersHorizontal } from 'lucide-react'
import type { Lar, User } from '@/types'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { CalcadaDivider, calcadaStonesBg } from '@/components/brand/patterns'
import { recomendar } from '@/lib/matching'
import { vagasLivres } from '@/lib/forecast'
import { plural } from '@/lib/format'
import { paraPerfilInput, paraPerfilMatch } from '../model'
import { pessoa } from '../language'
import { diagnosticar, type Ajuste } from '../diagnose'
import { escreverSessao, KEY_PERFIL_RASCUNHO, type AcoesSessao, type Sessao } from '../useMatchSession'
import { ProfileSentence } from './ProfileSentence'
import { RankedItem } from './RankedItem'
import { DiagnosisCard } from './DiagnosisCard'
import { SavePanel } from './SavePanel'
import { MethodNote } from './MethodNote'
import { ResultsRadar } from './ResultsRadar'
import { urlPesquisa } from './searchLink'

const PAGINA = 8
const reduzMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function ResultsView({ sessao, acoes, lares, user }: { sessao: Sessao; acoes: AcoesSessao; lares: Lar[]; user: User | null }) {
  const { r } = sessao
  const p = useMemo(() => pessoa(r), [r])
  const perfil = useMemo(() => paraPerfilMatch(r), [r])
  const matches = useMemo(() => (perfil ? recomendar(lares, perfil, 80) : []), [lares, perfil])
  const larPorId = useMemo(() => new Map(lares.map((l) => [l.id, l])), [lares])
  const boas = useMemo(() => matches.filter((m) => m.compativel && m.score >= 50), [matches])
  const outras = useMemo(() => matches.filter((m) => !(m.compativel && m.score >= 50)), [matches])
  const comVaga = boas.filter((m) => vagasLivres(larPorId.get(m.larId)!) > 0).length
  const melhor = boas[0]
  const diag = useMemo(() => (boas.length < 3 ? diagnosticar(lares, r, p, matches) : null), [boas.length, lares, r, p, matches])

  const [verOutras, setVerOutras] = useState(false)
  const [limite, setLimite] = useState(PAGINA)
  const [destaque, setDestaque] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const h1 = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    h1.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  // sem sessão: o rascunho fica disponível para o painel depois do registo
  useEffect(() => {
    if (!user) escreverSessao(KEY_PERFIL_RASCUNHO, paraPerfilInput(r))
  }, [user, r])

  // perfil incompleto (não devia acontecer): volta ao passo em falta
  useEffect(() => {
    if (!perfil) acoes.verResultados()
  }, [perfil, acoes])

  const irPara = useCallback(
    (id: string) => {
      const i = boas.findIndex((m) => m.larId === id)
      if (i >= limite) setLimite(Math.ceil((i + 1) / PAGINA) * PAGINA)
      if (i === -1) setVerOutras(true)
      setDestaque(id)
      requestAnimationFrame(() =>
        document.getElementById(`sugestao-${id}`)?.scrollIntoView({ behavior: reduzMovimento() ? 'auto' : 'smooth', block: 'start' }),
      )
    },
    [boas, limite],
  )

  const aplicar = (a: Ajuste) => {
    if (a.passo != null) {
      acoes.irPara(a.passo)
      return
    }
    if (a.patch) {
      acoes.patch(a.patch)
      setLimite(PAGINA)
      toast.info('Pesquisa ajustada', a.label)
    }
  }

  if (!perfil) return null

  const n = boas.length
  const assinatura = JSON.stringify({ ...r, id: undefined })

  return (
    <div className="flex flex-1 flex-col">
      {/* cabeçalho escuro com a frase do perfil */}
      <section className="on-dark relative bg-pine-900 text-pine-50" style={calcadaStonesBg('#ffffff', 0.035)}>
        <div className="container-page pt-8 pb-14 lg:pt-12 lg:pb-20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold tracking-[0.12em] text-terra-200 uppercase">Ajuda-me a escolher · Sugestões</p>
            <div className="flex flex-wrap gap-1">
              <a
                href="#guardar"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById('guardar')?.scrollIntoView({ behavior: reduzMovimento() ? 'auto' : 'smooth', block: 'center' })
                }}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 font-bold text-pine-100 hover:bg-white/10 hover:text-white lg:hidden"
              >
                <Bookmark aria-hidden className="size-5" />
                Guardar
              </a>
              <button
                type="button"
                onClick={() => acoes.irPara(0)}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 font-bold text-pine-100 hover:bg-white/10 hover:text-white"
              >
                <SlidersHorizontal aria-hidden className="size-5" />
                Rever respostas
              </button>
              <button
                type="button"
                onClick={() => setConfirmar(true)}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 font-bold text-pine-100 hover:bg-white/10 hover:text-white"
              >
                <RotateCcw aria-hidden className="size-5" />
                Recomeçar
              </button>
            </div>
          </div>

          <div className="lg:grid lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-8">
              <h1 ref={h1} tabIndex={-1} className="mt-6 font-display text-4xl font-semibold text-white outline-none sm:text-5xl lg:mt-8">
                {n > 0 ? (
                  p.proprio ? (
                    <>
                      <em>{plural(n, 'lar', 'lares')}</em> à sua medida
                    </>
                  ) : (
                    <>
                      <em>{plural(n, 'lar', 'lares')}</em> {n === 1 ? 'pode' : 'podem'} receber {p.a}
                    </>
                  )
                ) : p.proprio ? (
                  <>
                    Ainda não há um lar à sua medida — mas há <em>caminhos</em>.
                  </>
                ) : (
                  <>
                    Ainda não encontrámos lugar para {p.a} — mas há <em>caminhos</em>.
                  </>
                )}
              </h1>
              <ProfileSentence r={r} onAlterar={acoes.irPara} className="mt-6 max-w-3xl" />
              <p className="mt-3 text-sm text-pine-200">Toque numa parte sublinhada para a alterar.</p>

              <dl className="mt-10 grid max-w-3xl grid-cols-3 gap-4 border-t border-white/15 pt-6 sm:gap-8">
                <div className="flex flex-col-reverse gap-1">
                  <dt className="text-sm leading-snug text-pine-200">{n === 1 ? 'compatível' : 'compatíveis'}</dt>
                  <dd className="font-display text-4xl leading-none font-semibold text-white tabular sm:text-5xl">{n}</dd>
                </div>
                <div className="flex flex-col-reverse gap-1">
                  <dt className="text-sm leading-snug text-pine-200">com vaga agora</dt>
                  <dd className="font-display text-4xl leading-none font-semibold text-leaf-200 tabular sm:text-5xl">{comVaga}</dd>
                </div>
                <div className="flex flex-col-reverse gap-1">
                  <dt className="text-sm leading-snug text-pine-200">
                    melhor correspondência
                    {melhor && <span className="hidden truncate text-pine-300 sm:block">{larPorId.get(melhor.larId)?.nome}</span>}
                  </dt>
                  <dd className="font-display text-4xl leading-none font-semibold text-terra-200 tabular sm:text-5xl">
                    {melhor ? `${melhor.score}%` : '—'}
                  </dd>
                </div>
              </dl>
              <p className="sr-only" aria-live="polite">
                {n ? `${plural(n, 'sugestão compatível', 'sugestões compatíveis')}, ${comVaga} com vaga agora.` : 'Sem sugestões compatíveis.'}
              </p>
            </div>
          </div>
        </div>
      </section>
      <CalcadaDivider bg="#163a37" color="#fbf8f3" height={22} />

      <div className="container-page grid gap-10 pt-6 pb-20 lg:grid-cols-12 lg:gap-12">
        {/* lista */}
        <div className="flex min-w-0 flex-col gap-10 lg:col-span-8">
          {n === 0 &&
            (diag ? (
              <DiagnosisCard d={diag} variante="vazio" onAjuste={aplicar} />
            ) : (
              <EmptyState
                icon={<SearchX />}
                title="Sem sugestões para estas respostas"
                text="Experimente alargar a distância ou rever o orçamento."
                action={<Button onClick={() => acoes.irPara(3)}>Rever a zona</Button>}
              />
            ))}

          {(n > 0 || outras.length > 0) && (
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div>
                <h2 className="font-display text-3xl font-semibold text-ink">
                  {n > 0 ? (
                    <>
                      Por ordem de <em>compatibilidade</em>
                    </>
                  ) : (
                    'Para comparar'
                  )}
                </h2>
                <Link to={urlPesquisa(r)} className="link mt-1 inline-flex min-h-12 items-center gap-2 text-base">
                  <MapIcon aria-hidden className="size-5" />
                  Ver esta pesquisa no mapa de vagas
                </Link>
              </div>
              {outras.length > 0 && (
                <Switch
                  checked={verOutras}
                  onChange={setVerOutras}
                  label="Mostrar também as pouco compatíveis"
                  description={plural(outras.length, 'instituição', 'instituições')}
                  className="max-w-sm"
                />
              )}
            </div>
          )}

          {n > 0 && (
            <ol role="list" aria-label="Sugestões compatíveis" className="flex flex-col gap-10">
              {boas.slice(0, limite).map((m, i) => (
                <RankedItem
                  key={m.larId}
                  lar={larPorId.get(m.larId)!}
                  m={m}
                  rank={i + 1}
                  destaque={destaque === m.larId}
                  onHover={setDestaque}
                  aberto={i === 0}
                />
              ))}
            </ol>
          )}
          {n > limite && (
            <Button variant="secondary" size="lg" onClick={() => setLimite((l) => l + PAGINA)} className="self-start">
              Mostrar mais {Math.min(PAGINA, n - limite)} (faltam {n - limite})
            </Button>
          )}

          {diag && n > 0 && <DiagnosisCard d={diag} variante="poucas" onAjuste={aplicar} />}

          {verOutras && outras.length > 0 && (
            <section aria-labelledby="outras-t" className="flex animate-fade-in flex-col gap-6 border-t-2 border-dashed border-line-strong pt-8">
              <div>
                <h2 id="outras-t" className="font-display text-2xl font-semibold text-ink">
                  Pouco compatíveis
                </h2>
                <p className="mt-1 max-w-2xl text-base text-ink-soft">
                  Falham um requisito essencial ou ficam abaixo de 50%. Mostramos para poder comparar — abra "Porque sugerimos" para
                  ver o que falta.
                </p>
              </div>
              <ol role="list" aria-label="Instituições pouco compatíveis" className="flex flex-col gap-10">
                {outras.map((m, i) => (
                  <RankedItem
                    key={m.larId}
                    lar={larPorId.get(m.larId)!}
                    m={m}
                    rank={n + i + 1}
                    destaque={destaque === m.larId}
                    onHover={setDestaque}
                    apagado
                  />
                ))}
              </ol>
            </section>
          )}

          <MethodNote className="mt-4" />
        </div>

        {/* lateral: proximidade + guardar */}
        <aside aria-label="Mapa de proximidade e guardar perfil" className="relative z-10 lg:col-span-4 lg:-mt-80">
          <div className="flex flex-col gap-6 lg:sticky lg:top-24">
            <ResultsRadar
              r={r}
              boas={boas}
              outras={verOutras ? outras : []}
              larPorId={larPorId}
              destaque={destaque}
              onPonto={irPara}
            />
            <SavePanel key={assinatura} r={r} user={user} nResultados={n} onGuardado={(id) => acoes.patch({ id })} />
          </div>
        </aside>
      </div>

      <Modal
        open={confirmar}
        onClose={() => setConfirmar(false)}
        title="Recomeçar o questionário?"
        description="As respostas deste separador são apagadas."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmar(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmar(false)
                escreverSessao(KEY_PERFIL_RASCUNHO, null)
                acoes.recomecar()
              }}
              iconRight={<ArrowRight aria-hidden className="size-5" />}
            >
              Apagar e recomeçar
            </Button>
          </>
        }
      >
        <p className="text-base text-ink-soft">
          {user?.role === 'familia'
            ? 'Os perfis que já guardou na sua conta não são afetados.'
            : 'Se quiser manter estas respostas, crie uma conta e guarde o perfil antes de recomeçar.'}
        </p>
      </Modal>
    </div>
  )
}
