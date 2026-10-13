import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { Lar, User } from '@/types'
import { Button, TextLink } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { Reveal, useLenis } from '@/components/motion'
import { useAcesso } from '@/lib/store'
import { PESOS, recomendar, type MatchResult } from '@/lib/matching'
import { vagaParaNovos } from '@/lib/forecast'
import { plural } from '@/lib/format'
import { paraPerfilInput, paraPerfilMatch } from '../model'
import { deLocal, pessoa } from '../language'
import { diagnosticar, type Ajuste } from '../diagnose'
import { escreverSessao, KEY_PERFIL_RASCUNHO, type AcoesSessao, type Sessao } from '../useMatchSession'
import { ProfileSentence } from './ProfileSentence'
import { RankedItem } from './RankedItem'
import { DiagnosisCard } from './DiagnosisCard'
import { SavePanel } from './SavePanel'
import { ResultsStats } from './ResultsStats'
import { SaveBar } from './SaveBar'
import { ResultadosGratis } from './ResultadosGratis'
import { urlPesquisa } from './searchLink'
import { procuraDoPerfil } from './procura'
import { useRegistoProcura } from '@/features/search/procura'
import { scrollPara } from '../motion'
import { cn } from '@/lib/cn'
import { NotaFinal } from '../NotaFinal'

const PAGINA = 8

/** O motor escreve "A 2 km de Porto"; em PT-PT é "do Porto", "da Maia", "da sua localização". */
function comArtigo(m: MatchResult, label: string): MatchResult {
  const fim = ` de ${label}`
  return {
    ...m,
    razoes: m.razoes.map((x) =>
      x.texto.endsWith(fim) ? { ...x, texto: `${x.texto.slice(0, -fim.length)} ${deLocal(label)}` } : x,
    ),
  }
}

export function ResultsView({
  sessao,
  acoes,
  lares,
  user,
}: {
  sessao: Sessao
  acoes: AcoesSessao
  lares: Lar[]
  user: User | null
}) {
  const { r } = sessao
  // versão grátis (visitantes, famílias sem passe, instituições): quantas e quantas com vaga, nunca quais
  const { completo } = useAcesso()
  const p = useMemo(() => pessoa(r), [r])
  const perfil = useMemo(() => paraPerfilMatch(r), [r])
  const matches = useMemo(
    () => (perfil ? recomendar(lares, perfil, 80).map((m) => comArtigo(m, perfil.local.label)) : []),
    [lares, perfil],
  )
  const larPorId = useMemo(() => new Map(lares.map((l) => [l.id, l])), [lares])
  const compativeis = useMemo(() => matches.filter((m) => m.compativel && m.score >= 50), [matches])
  const outras = useMemo(() => matches.filter((m) => !(m.compativel && m.score >= 50)), [matches])
  // as sugestões contam só dentro da distância escolhida; as compatíveis mais longe ficam num grupo à parte
  const raio = perfil?.raioKm ?? 0
  const boas = useMemo(() => compativeis.filter((m) => m.distanciaKm <= raio), [compativeis, raio])
  const longe = useMemo(() => compativeis.filter((m) => m.distanciaKm > raio), [compativeis, raio])
  // "com vaga agora" = vaga para quem pede hoje (um lugar livre prometido à lista de espera não conta)
  const comVaga = boas.filter((m) => vagaParaNovos(larPorId.get(m.larId)!, m.espera)).length
  // nenhuma compatível com vaga agora na zona: registo anónimo da procura (sem o nome), quando as respostas assentam
  const procura = useMemo(() => (perfil ? procuraDoPerfil(perfil, boas.length, comVaga) : null), [perfil, boas.length, comVaga])
  useRegistoProcura(procura, JSON.stringify(perfil))
  // nenhuma sugestão cabe no orçamento: também vale a pena explicar o que limita
  const semNenhumaNoOrcamento = boas.length > 0 && perfil != null && !boas.some((m) => m.precoRef <= perfil.orcamentoMax)
  const diag = useMemo(
    () => (boas.length < 3 || semNenhumaNoOrcamento ? diagnosticar(lares, r, p, matches, { generico: !completo }) : null),
    [boas.length, semNenhumaNoOrcamento, lares, r, p, matches, completo],
  )
  // com muitas sugestões, o diagnóstico vem antes da lista; com uma ou duas, depois
  const diagAntes = diag != null && boas.length >= 3

  const [verOutras, setVerOutras] = useState(false)
  // as mais longe abrem-se sozinhas quando há poucas sugestões no raio (até a pessoa decidir)
  const [verLongeEscolha, setVerLonge] = useState<boolean | null>(null)
  const verLonge = verLongeEscolha ?? boas.length < 3
  const [limite, setLimite] = useState(PAGINA)
  const [limiteLonge, setLimiteLonge] = useState(PAGINA)
  const [confirmar, setConfirmar] = useState(false)
  const h1 = useRef<HTMLHeadingElement>(null)
  const resumoRef = useRef<HTMLDivElement>(null)
  const lenis = useLenis()

  useEffect(() => {
    // chega das perguntas: começa no topo sem animação (o título entra com a sua própria coreografia)
    scrollPara(lenis, 0, { instant: true })
    h1.current?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao chegar
  }, [])

  // sem sessão: o rascunho fica disponível para o painel depois do registo (contrato em docs/DESIGN.md)
  useEffect(() => {
    if (user) return
    const input = paraPerfilInput(r)
    escreverSessao(KEY_PERFIL_RASCUNHO, input ? { ...input, nome: r.nome.trim() } : null)
  }, [user, r])

  if (!perfil) return null

  const n = boas.length
  const guardado = (id: string) => acoes.patch({ id })
  const aplicar = (a: Ajuste) => {
    if (a.passo != null) return acoes.irPara(a.passo)
    if (a.patch) {
      acoes.patch(a.patch)
      setLimite(PAGINA)
      setLimiteLonge(PAGINA)
      toast.info('Pesquisa ajustada', a.label)
    }
  }

  const titulo =
    n > 0 ? (
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
      'Ainda sem lugar à sua medida'
    ) : (
      `Ainda sem lugar para ${p.a}`
    )

  return (
    <div className="flex flex-1 flex-col">
      <div ref={resumoRef}>
        <section className="container-narrow pt-12 pb-12 text-center sm:pt-20 sm:pb-20">
          <Reveal variant="blur" duration={1100}>
            <p className="eyebrow">Sugestões</p>
            <h1
              ref={h1}
              tabIndex={-1}
              className="mx-auto mt-3 max-w-3xl font-display text-[2.5rem] leading-[1.06] font-semibold text-ink outline-none sm:text-5xl lg:text-6xl"
            >
              {titulo}
            </h1>
          </Reveal>
          <Reveal delay={160} duration={900}>
            <ProfileSentence r={r} onAlterar={acoes.irPara} className="mx-auto mt-7 max-w-4xl" />
            <p className="mt-3 text-sm text-ink-mute">Toque numa parte sublinhada para a alterar.</p>
          </Reveal>
          <Reveal delay={280} duration={900} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button variant="subtle" onClick={() => acoes.irPara(0)}>
              Rever respostas
            </Button>
            <Button variant="ghost" onClick={() => setConfirmar(true)}>
              Recomeçar
            </Button>
          </Reveal>
        </section>

        {n > 0 && <ResultsStats n={n} comVaga={comVaga} melhor={boas[0]?.score ?? null} />}
      </div>
      <p className="sr-only" aria-live="polite">
        {n
          ? `${plural(n, 'sugestão compatível', 'sugestões compatíveis')}, ${comVaga} com vaga agora.`
          : 'Sem sugestões compatíveis.'}
      </p>

      <section
        aria-labelledby="lista-t"
        className={n > 0 ? 'container-narrow py-16 sm:py-24' : 'container-narrow pb-16 sm:pb-24'}
      >
        {n === 0 && (
          <Reveal variant="scale" delay={200} className="mb-16">
            {diag ? (
              <DiagnosisCard d={diag} variante="vazio" onAjuste={aplicar} />
            ) : (
              <EmptyState
                title="Sem sugestões para estas respostas"
                text="Experimente alargar a distância ou rever o orçamento."
                action={<Button onClick={() => acoes.irPara(3)}>Rever a zona</Button>}
              />
            )}
          </Reveal>
        )}

        {diag && diagAntes && (
          <Reveal variant="scale" className="mb-16">
            <DiagnosisCard d={diag} variante="poucas" onAjuste={aplicar} />
          </Reveal>
        )}

        {n > 0 && (
          <Reveal>
            <h2 id="lista-t" className="text-3xl font-semibold text-ink sm:text-4xl">
              Por ordem de compatibilidade
            </h2>
            <TextLink to={urlPesquisa(r)} className="mt-1 min-h-12 text-base">
              Ver no mapa de vagas
            </TextLink>
          </Reveal>
        )}
        {n === 0 && (
          <h2 id="lista-t" className="sr-only">
            Sugestões
          </h2>
        )}

        {n > 0 && completo && (
          <ol aria-label="Sugestões compatíveis" className="mt-6 divide-y divide-line">
            {boas.slice(0, limite).map((m, i) => (
              <RankedItem key={m.larId} lar={larPorId.get(m.larId)!} m={m} melhor={i === 0} />
            ))}
          </ol>
        )}
        {n > 0 && !completo && (
          <ResultadosGratis n={n} longe={longe.length} raio={raio} instituicao={user?.role === 'lar'} className="mt-6" />
        )}
        {completo && n > limite && (
          <div className="mt-6 text-center">
            <Button variant="subtle" size="lg" onClick={() => setLimite((l) => l + PAGINA)} className="w-full sm:w-auto">
              Mostrar mais {Math.min(PAGINA, n - limite)}
            </Button>
          </div>
        )}

        {diag && n > 0 && !diagAntes && (
          <Reveal variant="scale" className="mt-12">
            <DiagnosisCard d={diag} variante="poucas" onAjuste={aplicar} />
          </Reveal>
        )}

        {/* versão grátis sem sugestões no raio: só quantas há mais longe (o diagnóstico ajuda a alargar) */}
        {!completo && n === 0 && longe.length > 0 && (
          <ResultadosGratis n={0} longe={longe.length} raio={raio} instituicao={user?.role === 'lar'} className="border-t border-line pt-6" />
        )}

        {completo && longe.length > 0 && (
          <Switch
            checked={verLonge}
            onChange={setVerLonge}
            label={`Mostrar também as que ficam a mais de ${raio} km`}
            description={`${plural(longe.length, 'instituição compatível', 'instituições compatíveis')} fora da distância que escolheu.`}
            className={cn('border-t border-line pt-6', n > 0 ? 'mt-12' : 'mt-0')}
          />
        )}

        {completo && verLonge && longe.length > 0 && (
          <section
            aria-labelledby="longe-t"
            className="mt-16 transition-[opacity,translate] duration-700 ease-[cubic-bezier(.16,1,.3,1)] starting:translate-y-4 starting:opacity-0"
          >
            <h2 id="longe-t" className="text-2xl font-semibold text-ink sm:text-3xl">
              Mais longe, fora dos {raio} km
            </h2>
            <p className="mt-2 max-w-2xl text-base text-ink-mute">
              Compatíveis, mas a mais de {raio} km {deLocal(perfil.local.label)}. Por ordem de compatibilidade.
            </p>
            <ol aria-label={`Sugestões a mais de ${raio} km`} className="mt-4 divide-y divide-line">
              {longe.slice(0, limiteLonge).map((m) => (
                <RankedItem key={m.larId} lar={larPorId.get(m.larId)!} m={m} />
              ))}
            </ol>
            {longe.length > limiteLonge && (
              <div className="mt-6 text-center">
                <Button
                  variant="subtle"
                  size="lg"
                  onClick={() => setLimiteLonge((l) => l + PAGINA)}
                  className="w-full sm:w-auto"
                >
                  Mostrar mais {Math.min(PAGINA, longe.length - limiteLonge)}
                </Button>
              </div>
            )}
          </section>
        )}

        {completo && outras.length > 0 && (
          <Switch
            checked={verOutras}
            onChange={setVerOutras}
            label="Mostrar também as pouco compatíveis"
            description={`${plural(outras.length, 'instituição', 'instituições')} que ${outras.length === 1 ? 'falha' : 'falham'} um requisito essencial ou ${outras.length === 1 ? 'fica' : 'ficam'} abaixo de 50%.`}
            className="mt-12 border-t border-line pt-6"
          />
        )}

        {completo && verOutras && outras.length > 0 && (
          <section
            aria-labelledby="outras-t"
            className="mt-16 transition-[opacity,translate] duration-700 ease-[cubic-bezier(.16,1,.3,1)] starting:translate-y-4 starting:opacity-0"
          >
            <h2 id="outras-t" className="text-2xl font-semibold text-ink sm:text-3xl">
              Pouco compatíveis
            </h2>
            <p className="mt-2 max-w-2xl text-base text-ink-mute">Abra «Porque sugerimos» para ver o que falta em cada uma.</p>
            <ol aria-label="Instituições pouco compatíveis" className="mt-4 divide-y divide-line">
              {outras.map((m) => (
                <RankedItem key={m.larId} lar={larPorId.get(m.larId)!} m={m} apagado />
              ))}
            </ol>
          </section>
        )}
      </section>

      <div className="container-narrow pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:pb-6">
        <Reveal variant="scale" duration={1100}>
          <SavePanel key={JSON.stringify({ ...r, id: undefined })} r={r} user={user} onGuardado={guardado} />
        </Reveal>
        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-ink-mute">
          Ordenamos por cuidados de saúde ({PESOS.cuidados} pontos), orçamento ({PESOS.orcamento}), distância ({PESOS.distancia}),
          vaga para o prazo ({PESOS.disponibilidade}) e preferências ({PESOS.preferencias}). A previsão de vagas é uma estimativa,
          não uma garantia.{' '}
          <Link to="/como-ordenamos" className="link inline-flex items-center">
            Como ordenamos
            <ChevronRight aria-hidden className="size-3.5" />
          </Link>
          {' · '}
          <Link to="/sobre#previsao" className="link inline-flex items-center">
            Como calculamos a previsão
            <ChevronRight aria-hidden className="size-3.5" />
          </Link>
        </p>
        <NotaFinal className="mt-8" />
      </div>

      <SaveBar r={r} user={user} n={n} onGuardado={guardado} depoisDe={resumoRef} />

      <Modal
        open={confirmar}
        onClose={() => setConfirmar(false)}
        title="Recomeçar o questionário?"
        description="As respostas deste separador são apagadas."
        footer={
          <>
            <Button variant="subtle" onClick={() => setConfirmar(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setConfirmar(false)
                escreverSessao(KEY_PERFIL_RASCUNHO, null)
                acoes.recomecar()
              }}
            >
              Apagar e recomeçar
            </Button>
          </>
        }
      >
        <p className="text-base text-ink-mute">
          {user?.role === 'familia'
            ? 'Os perfis que já guardou na sua conta não são afetados.'
            : 'Se quiser manter estas respostas, crie uma conta e guarde o perfil antes de recomeçar.'}
        </p>
      </Modal>
    </div>
  )
}
