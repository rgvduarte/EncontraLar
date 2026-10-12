import { ChevronRight } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import type { Candidatura, Lar } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { AvailabilityBadge } from '@/components/lar/badges'
import { FavoriteButton } from '@/components/lar/FavoriteButton'
import { setAlerta, useCurrentUser, useFavorito } from '@/lib/store'
import { pct, plural } from '@/lib/format'
import { QUARTO_CURTO } from '@/lib/labels'
import { esperaEstimada, irParaSecao, precoResumo, precoSocial, telHref, type DadosLar } from './helpers'
import { CandidaturaAtiva } from './CandidaturaAtiva'

/** Preço em destaque: "desde 1550 €/mês" (privado) ou intervalo conforme rendimentos (IPSS/Misericórdia). */
function Preco({ lar }: { lar: Lar }) {
  const p = precoResumo(lar)
  if (!p) return <p className="text-3xl font-semibold tracking-tight">Preço sob consulta</p>
  return (
    <div>
      <p className="text-ink">
        {p.desde && <span className="mr-1.5 text-base text-ink-mute">desde</span>}
        <span className="text-[2.5rem] font-semibold tracking-tight whitespace-nowrap tabular sm:text-4xl">{p.valor}</span>
        <span className="text-base text-ink-mute">/mês</span>
      </p>
      {precoSocial(lar) && <p className="mt-1 text-sm text-ink-mute">Conforme os rendimentos</p>}
    </div>
  )
}

/** Contexto da disponibilidade numa linha: tipo de quarto livre ou tamanho da lista de espera. */
function contexto(lar: Lar, dados: DadosLar): string {
  if (dados.livres > 0) {
    if (dados.centroDia) return 'Frequência diária'
    const tipos = lar.quartos.filter((q) => q.livres > 0).map((q) => QUARTO_CURTO[q.tipo].toLowerCase())
    return `Quarto ${tipos.join(' e ')}`
  }
  return lar.listaEspera > 0 ? `${plural(lar.listaEspera, 'pessoa', 'pessoas')} à espera` : 'Ninguém à espera'
}

/** Previsão para quem pede hoje, em duas linhas (estilo ficha técnica). */
function Previsao({ dados }: { dados: DadosLar }) {
  const { est, livres, unidade } = dados
  const linhas = est.imediata
    ? [
        { t: `${unidade.um === 'lugar' ? 'Lugar' : 'Vaga'} livre para si`, v: 'Sim' },
        { t: 'Pessoas à sua frente', v: '0' },
      ]
    : [
        { t: `Probabilidade de ${unidade.um} em 3 meses`, v: pct(est.p90) },
        { t: 'Espera estimada', v: esperaEstimada(est) },
      ]
  return (
    <div>
      <p className="text-sm text-ink-mute">Se pedir hoje</p>
      <dl className="mt-2 flex flex-col gap-1.5">
        {linhas.map((l) => (
          <div key={l.t} className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-soft">{l.t}</dt>
            <dd className="shrink-0 font-semibold text-ink tabular">{l.v}</dd>
          </div>
        ))}
      </dl>
      {!est.imediata && livres > 0 && (
        <p className="mt-2 text-sm text-ink-mute">
          {livres === 1 ? `A ${unidade.um} livre deverá ir` : `As ${unidade.varios} livres deverão ir`} para quem já está na lista.
        </p>
      )}
      <button
        type="button"
        onClick={() => irParaSecao('ficha-previsao')}
        className="mt-1 inline-flex min-h-11 items-center gap-0.5 text-sm text-terra-600 hover:underline"
      >
        Como calculamos
        <ChevronRight aria-hidden className="size-4" />
      </button>
    </div>
  )
}

/** Cartão fixo à direita (e no fluxo, no telemóvel): preço, vagas, previsão e as ações. */
export function VagasCard({
  lar,
  dados,
  ativa,
  onPedir,
  onVisita,
  onVisitaExistente,
  ctaRef,
}: {
  lar: Lar
  dados: DadosLar
  ativa?: Candidatura
  onPedir: () => void
  onVisita: () => void
  onVisitaExistente: (c: Candidatura) => void
  ctaRef?: React.Ref<HTMLDivElement>
}) {
  const user = useCurrentUser()
  const fav = useFavorito(lar.id)
  const navigate = useNavigate()
  const location = useLocation()
  const gestor = user?.role === 'lar'
  const minhaFicha = gestor && user.larId === lar.id
  const ctaLabel = dados.livres > 0 ? (dados.centroDia ? 'Pedir lugar' : 'Pedir vaga') : 'Entrar na lista de espera'

  const alternarAlerta = (v: boolean) => {
    if (!user) {
      toast.info('Entre para receber alertas', 'Com uma conta gratuita avisamos assim que abrir uma vaga.')
      navigate(`/entrar?voltar=${encodeURIComponent(location.pathname)}`)
      return
    }
    setAlerta(lar.id, v)
    if (v) toast.success('Alerta de vaga ativado', `Avisamos assim que ${lar.nome} indicar um lugar livre.`)
    else toast.info('Alerta desativado', 'Deixa de receber avisos de vaga desta instituição.')
  }

  return (
    <section aria-labelledby="vagas-titulo" className="rounded-[1.75rem] bg-white p-6 ring-1 ring-line sm:p-7">
      <h2 id="vagas-titulo" className="sr-only">
        Preço e vagas
      </h2>
      <Preco lar={lar} />

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1" aria-live="polite">
        <AvailabilityBadge lar={lar} estado={dados.disp} size="md" />
        <span className="text-sm text-ink-mute">{contexto(lar, dados)}</span>
      </div>

      <div className="mt-6 border-t border-line pt-5">
        {ativa ? (
          <div ref={ctaRef}>
            <CandidaturaAtiva lar={lar} c={ativa} onVisita={() => onVisitaExistente(ativa)} />
          </div>
        ) : minhaFicha ? (
          <div ref={ctaRef}>
            <p className="font-semibold text-ink">Esta é a ficha da sua instituição.</p>
            <p className="mt-1 text-sm text-ink-mute">É assim que as famílias a veem. Vagas em dia aparecem primeiro.</p>
            <ButtonLink to="/gestao/ficha" variant="primary" size="lg" full className="mt-5">
              Editar ficha e vagas
            </ButtonLink>
          </div>
        ) : (
          <>
            <Previsao dados={dados} />
            <div ref={ctaRef} className="mt-5 flex flex-col gap-3">
              <Button size="lg" full onClick={onPedir}>
                {ctaLabel}
              </Button>
              <Button variant="subtle" size="lg" full onClick={onVisita}>
                Marcar visita
              </Button>
            </div>
          </>
        )}
      </div>

      {!gestor && (
        <div className="mt-6 border-t border-line pt-3">
          <Switch
            checked={Boolean(fav?.alerta)}
            onChange={alternarAlerta}
            label="Avisar-me de vagas"
            description={user ? undefined : 'Precisa de conta gratuita'}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <FavoriteButton larId={lar.id} larNome={lar.nome} variant="inline" />
            {lar.telefone && (
              <a href={telHref(lar.telefone)} className="inline-flex min-h-12 items-center text-sm text-terra-600 hover:underline">
                Ligar <span className="ml-1 tabular">{lar.telefone}</span>
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
