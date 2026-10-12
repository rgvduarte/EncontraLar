import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { Lar, User } from '@/types'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { Reveal } from '@/components/ui/Reveal'
import { PESOS, recomendar, type MatchResult } from '@/lib/matching'
import { vagasLivres } from '@/lib/forecast'
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
import { urlPesquisa } from './searchLink'

const PAGINA = 8

/** O motor escreve "A 2 km de Porto"; em PT-PT é "do Porto", "da Maia", "da sua localização". */
function comArtigo(m: MatchResult, label: string): MatchResult {
  const fim = ` de ${label}`
  return { ...m, razoes: m.razoes.map((x) => (x.texto.endsWith(fim) ? { ...x, texto: `${x.texto.slice(0, -fim.length)} ${deLocal(label)}` } : x)) }
}

export function ResultsView({ sessao, acoes, lares, user }: { sessao: Sessao; acoes: AcoesSessao; lares: Lar[]; user: User | null }) {
  const { r } = sessao
  const p = useMemo(() => pessoa(r), [r])
  const perfil = useMemo(() => paraPerfilMatch(r), [r])
  const matches = useMemo(() => (perfil ? recomendar(lares, perfil, 80).map((m) => comArtigo(m, perfil.local.label)) : []), [lares, perfil])
  const larPorId = useMemo(() => new Map(lares.map((l) => [l.id, l])), [lares])
  const boas = useMemo(() => matches.filter((m) => m.compativel && m.score >= 50), [matches])
  const outras = useMemo(() => matches.filter((m) => !(m.compativel && m.score >= 50)), [matches])
  const comVaga = boas.filter((m) => vagasLivres(larPorId.get(m.larId)!) > 0).length
  const diag = useMemo(() => (boas.length < 3 ? diagnosticar(lares, r, p, matches) : null), [boas.length, lares, r, p, matches])

  const [verOutras, setVerOutras] = useState(false)
  const [limite, setLimite] = useState(PAGINA)
  const [confirmar, setConfirmar] = useState(false)
  const h1 = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
    h1.current?.focus({ preventScroll: true })
  }, [])

  // sem sessão: o rascunho fica disponível para o painel depois do registo (contrato em docs/DESIGN.md)
  useEffect(() => {
    if (user) return
    const input = paraPerfilInput(r)
    escreverSessao(KEY_PERFIL_RASCUNHO, input ? { ...input, nome: r.nome.trim() } : null)
  }, [user, r])

  // perfil incompleto (não devia acontecer): volta ao passo em falta
  useEffect(() => {
    if (!perfil) acoes.verResultados()
  }, [perfil, acoes])

  if (!perfil) return null

  const n = boas.length
  const aplicar = (a: Ajuste) => {
    if (a.passo != null) return acoes.irPara(a.passo)
    if (a.patch) {
      acoes.patch(a.patch)
      setLimite(PAGINA)
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
      <section className="container-narrow pt-14 pb-14 text-center sm:pt-20 sm:pb-20">
        <div className="animate-fade-up">
          <p className="eyebrow">Sugestões</p>
          <h1
            ref={h1}
            tabIndex={-1}
            className="mx-auto mt-3 max-w-3xl font-display text-[2.5rem] leading-[1.06] font-semibold text-ink outline-none sm:text-5xl lg:text-6xl"
          >
            {titulo}
          </h1>
          <ProfileSentence r={r} onAlterar={acoes.irPara} className="mx-auto mt-7 max-w-4xl" />
          <p className="mt-3 text-sm text-ink-mute">Toque numa parte sublinhada para a alterar.</p>
        </div>
        <div className="mt-8 flex animate-fade-up flex-wrap items-center justify-center gap-3 [animation-delay:100ms]">
          <Button variant="subtle" onClick={() => acoes.irPara(0)}>
            Rever respostas
          </Button>
          <Button variant="ghost" onClick={() => setConfirmar(true)}>
            Recomeçar
          </Button>
        </div>
      </section>

      {n > 0 && <ResultsStats n={n} comVaga={comVaga} melhor={boas[0]?.score ?? null} />}
      <p className="sr-only" aria-live="polite">
        {n ? `${plural(n, 'sugestão compatível', 'sugestões compatíveis')}, ${comVaga} com vaga agora.` : 'Sem sugestões compatíveis.'}
      </p>

      <section aria-labelledby="lista-t" className={n > 0 ? 'container-narrow py-16 sm:py-24' : 'container-narrow pb-16 sm:pb-24'}>
        {n === 0 && (
          <div className="mb-16">
            {diag ? (
              <DiagnosisCard d={diag} variante="vazio" onAjuste={aplicar} />
            ) : (
              <EmptyState
                title="Sem sugestões para estas respostas"
                text="Experimente alargar a distância ou rever o orçamento."
                action={<Button onClick={() => acoes.irPara(3)}>Rever a zona</Button>}
              />
            )}
          </div>
        )}

        {n > 0 && (
          <div>
            <h2 id="lista-t" className="text-3xl font-semibold text-ink sm:text-4xl">
              Por ordem de compatibilidade
            </h2>
            <Link to={urlPesquisa(r)} className="link mt-1 inline-flex min-h-12 items-center gap-0.5 text-base">
              Ver no mapa de vagas
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          </div>
        )}
        {n === 0 && (
          <h2 id="lista-t" className="sr-only">
            Sugestões
          </h2>
        )}

        {n > 0 && (
          <ol aria-label="Sugestões compatíveis" className="mt-6 divide-y divide-line">
            {boas.slice(0, limite).map((m, i) => (
              <RankedItem key={m.larId} lar={larPorId.get(m.larId)!} m={m} melhor={i === 0} />
            ))}
          </ol>
        )}
        {n > limite && (
          <div className="mt-6 text-center">
            <Button variant="subtle" size="lg" onClick={() => setLimite((l) => l + PAGINA)}>
              Mostrar mais {Math.min(PAGINA, n - limite)}
            </Button>
          </div>
        )}

        {diag && n > 0 && <DiagnosisCard d={diag} variante="poucas" onAjuste={aplicar} className="mt-12" />}

        {outras.length > 0 && (
          <Switch
            checked={verOutras}
            onChange={setVerOutras}
            label="Mostrar também as pouco compatíveis"
            description={`${plural(outras.length, 'instituição', 'instituições')} que ${outras.length === 1 ? 'falha' : 'falham'} um requisito essencial ou ${outras.length === 1 ? 'fica' : 'ficam'} abaixo de 50%.`}
            className="mt-12 border-t border-line pt-6"
          />
        )}

        {verOutras && outras.length > 0 && (
          <section aria-labelledby="outras-t" className="mt-16 animate-fade-in">
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

      <div className="container-narrow pb-16 sm:pb-24">
        <Reveal>
          <SavePanel key={JSON.stringify({ ...r, id: undefined })} r={r} user={user} onGuardado={(id) => acoes.patch({ id })} />
        </Reveal>
        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-ink-mute">
          Ordenamos por cuidados de saúde ({PESOS.cuidados} pontos), orçamento ({PESOS.orcamento}), distância ({PESOS.distancia}), vaga
          para o prazo ({PESOS.disponibilidade}) e preferências ({PESOS.preferencias}). A previsão de vagas é uma estimativa, não uma
          garantia.{' '}
          <Link to="/sobre#previsao" className="link inline-flex items-center">
            Como calculamos
            <ChevronRight aria-hidden className="size-3.5" />
          </Link>
        </p>
      </div>

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
