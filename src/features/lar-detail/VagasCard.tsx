import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import type { Candidatura, Lar } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { AvailabilityBadge } from '@/components/lar/badges'
import { FavoriteButton } from '@/components/lar/FavoriteButton'
import { BloqueioCartao, type AcaoAcesso } from '@/components/acesso'
import { setAlerta, useCurrentUser, useFavorito } from '@/lib/store'
import { pct, plural } from '@/lib/format'
import { QUARTO_CURTO } from '@/lib/labels'
import { cn } from '@/lib/cn'
import {
  caminhoFicha,
  ctaPedido,
  esperaEstimada,
  faixaPrecoPartes,
  oLar,
  pedirGenerico,
  precoResumo,
  precoSocial,
  telHref,
  type DadosLar,
} from './helpers'
import { CandidaturaAtiva } from './CandidaturaAtiva'
import { CasosEnviadosAqui } from './pedido/CasosProfissional'
import { useIrParaSecao } from './hooks'

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

/** Versão grátis: só a faixa de preço (o preço de cada quarto é do Acesso Família); IPSS/Misericórdia: "Conforme os rendimentos". */
function FaixaPreco({ lar }: { lar: Lar }) {
  const { valor, sufixo } = faixaPrecoPartes(lar)
  return (
    <div>
      <p className="text-sm text-ink-mute">{sufixo ? 'Faixa de preço' : 'Mensalidade'}</p>
      <p className="mt-1 text-ink">
        <span className="text-[1.75rem] leading-tight font-semibold tracking-tight sm:text-3xl">{valor}</span>
        {sufixo && <span className="text-base text-ink-mute">{sufixo}</span>}
      </p>
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
  const irParaSecao = useIrParaSecao()
  const linhas = est.imediata
    ? [
        { t: 'Espera estimada', v: 'Sem espera' },
        { t: 'Pessoas à sua frente', v: 'Nenhuma' },
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
        className="mt-1 inline-flex min-h-12 items-center gap-0.5 text-sm text-terra-600 hover:underline"
      >
        Como calculamos
        <ChevronRight aria-hidden className="size-4" />
      </button>
    </div>
  )
}

/**
 * Cartão fixo à direita (e no fluxo, no telemóvel): preço, vagas, previsão e as ações.
 *
 * Versão grátis (`completo` falso — visitantes, famílias sem passe, instituições): a faixa de preço e, no lugar das
 * vagas, dos quartos e da previsão, o bloqueio padrão com "Ver o Acesso Família" (a única ação principal do cartão).
 * "Pedir vaga", "Marcar visita" e o alerta ficam como ações secundárias que explicam o Acesso Família (`onAcesso`).
 * Os valores reais (lugares livres, preços, espera, telefone) não chegam ao DOM.
 */
export function VagasCard({
  lar,
  dados,
  ativa,
  completo,
  profissional = false,
  onPedir,
  onVisita,
  onVisitaExistente,
  onAcesso,
  ctaRef,
}: {
  lar: Lar
  dados: DadosLar
  ativa?: Candidatura
  /** vê a camada completa (useAcesso().completo): famílias com passe e profissionais */
  completo: boolean
  /** conta de serviço social: o pedido parte de um caso (PedidoModal) e não há "Marcar visita" */
  profissional?: boolean
  onPedir: () => void
  onVisita: () => void
  onVisitaExistente: (c: Candidatura) => void
  /** versão grátis: abre a folha do Acesso Família para uma ação paga */
  onAcesso: (acao: AcaoAcesso) => void
  ctaRef?: React.Ref<HTMLDivElement>
}) {
  const user = useCurrentUser()
  const fav = useFavorito(lar.id)
  const navigate = useNavigate()
  const location = useLocation()
  const gestor = user?.role === 'lar'
  // equipa de terreno: regista a visita (modo visita) em vez de pedir vaga; sem alertas nem guardados
  const equipa = user?.role === 'equipa'
  const minhaFicha = gestor && user.larId === lar.id
  const alerta = Boolean(fav?.alerta)
  // estados com animação de troca: só anima quando mudam (não à entrada da página)
  const estado = `${completo ? 'completo' : 'gratis'}-${ativa ? `ativa-${ativa.id}` : minhaFicha ? 'gestor' : 'livre'}`
  const estadoAlerta = alerta ? 'on' : completo ? 'off' : 'gratis'
  const [estado0] = useState(estado)
  const [estadoAlerta0] = useState(estadoAlerta)
  const ctaLabel = ctaPedido(dados)
  const ficha = caminhoFicha(lar)

  // sem sessão: vai entrar e volta com a intenção no URL, que a ficha aplica (LarPage lê ?guardar=)
  const entrarEVoltar = (intencao: string) => navigate(`/entrar?voltar=${encodeURIComponent(`${location.pathname}?${intencao}`)}`)

  const alternarAlerta = (v: boolean) => {
    // versão grátis (inclui quem não tem sessão): ligar o alerta é do Acesso Família; desligar fica sempre à mão
    if (v && !completo) {
      onAcesso('alerta')
      return
    }
    setAlerta(lar.id, v)
    if (v) toast.success('Alerta de vaga ativado', `Avisamos assim que ${oLar(lar.nome)} indicar um lugar livre.`)
    else toast.info('Alerta desativado', 'Deixa de receber avisos de vaga desta instituição.')
  }

  // o coração (componente partilhado) é intercetado antes do clique sem sessão, para guardar depois de entrar
  const guardarSemSessao = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toast.info('Entre para guardar', 'Crie uma conta gratuita para guardar instituições.')
    entrarEVoltar(`guardar=${encodeURIComponent(lar.id)}`)
  }

  // versão grátis: o bloqueio ocupa o lugar das vagas, dos quartos e da previsão (instituições: só a nota, sem botão)
  // (dentro do cartão o tile leva menos margem interior: o texto respira no telemóvel)
  const bloqueio = <BloqueioCartao titulo="Vagas, preços por quarto e previsão de espera" voltar={ficha} className="p-5 sm:p-6" />

  return (
    <section aria-labelledby="vagas-titulo" className="rounded-[1.75rem] bg-white p-6 ring-1 ring-line sm:p-7">
      <h2 id="vagas-titulo" className="sr-only">
        Preço e vagas
      </h2>

      {completo ? (
        <>
          <Preco lar={lar} />
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1" aria-live="polite">
            <AvailabilityBadge lar={lar} estado={dados.disp} size="md" />
            <span className="text-sm text-ink-mute">{contexto(lar, dados)}</span>
          </div>
        </>
      ) : (
        <FaixaPreco lar={lar} />
      )}

      {!completo && !ativa && !minhaFicha ? (
        // o bloqueio e as ações secundárias formam o bloco de ação do cartão (a barra do telemóvel some quando está à vista)
        <div key={estado} ref={ctaRef} className={cn('mt-5', estado !== estado0 && 'ficha-troca')}>
          {bloqueio}
          {/* secundárias (o convite principal é o do bloqueio): lado a lado quando o cartão é largo */}
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            <Button variant="secondary" full onClick={onPedir} className="px-4">
              {pedirGenerico(dados)}
            </Button>
            <Button variant="secondary" full onClick={onVisita} className="px-4">
              Marcar visita
            </Button>
          </div>
        </div>
      ) : (
        <>
          {!completo && <div className="mt-5">{bloqueio}</div>}
          {/* a troca de estado (pedir → pedido enviado) entra com desfoque suave em vez de saltar */}
          <div key={estado} className={cn('mt-6 border-t border-line pt-5', estado !== estado0 && 'ficha-troca')}>
            {ativa ? (
              <div ref={ctaRef}>
                <CandidaturaAtiva lar={lar} c={ativa} completo={completo} onVisita={() => onVisitaExistente(ativa)} />
              </div>
            ) : minhaFicha ? (
              <div ref={ctaRef}>
                <p className="font-semibold text-ink">Esta é a ficha da sua instituição.</p>
                <p className="mt-1 text-sm text-ink-mute">
                  {completo
                    ? 'É assim que as famílias a veem. Vagas em dia aparecem primeiro.'
                    : 'É assim que as famílias a veem. Com o Acesso Família, veem também as vagas, os preços por quarto e a previsão.'}
                </p>
                <ButtonLink to="/gestao/ficha" variant="primary" size="lg" full className="mt-5">
                  Editar ficha e vagas
                </ButtonLink>
              </div>
            ) : equipa ? (
              <>
                <Previsao dados={dados} />
                <div ref={ctaRef} className="mt-5">
                  <ButtonLink to={`/visitas/${encodeURIComponent(lar.id)}`} variant="primary" size="lg" full>
                    Registar visita
                  </ButtonLink>
                  <p className="mt-2 text-sm text-ink-mute">Confirmar licença, instalações, vagas e preços no modo visita.</p>
                </div>
              </>
            ) : (
              <>
                <Previsao dados={dados} />
                <div ref={ctaRef} className="mt-5 flex flex-col gap-3">
                  <Button size="lg" full onClick={onPedir}>
                    {ctaLabel}
                  </Button>
                  {!profissional && (
                    <Button variant="subtle" size="lg" full onClick={onVisita}>
                      Marcar visita
                    </Button>
                  )}
                </div>
                {profissional && <CasosEnviadosAqui larId={lar.id} />}
              </>
            )}
          </div>
        </>
      )}

      {!gestor && !equipa && (
        <div className="mt-6 border-t border-line pt-3">
          <Switch
            checked={alerta}
            onChange={alternarAlerta}
            label="Avisar-me de vagas"
            description={
              <span key={estadoAlerta} className={cn('block', estadoAlerta !== estadoAlerta0 && 'ficha-troca')}>
                {alerta ? 'Ativo: avisamos assim que abrir vaga' : completo ? 'Por email e no seu painel' : 'Com o Acesso Família'}
              </span>
            }
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="ficha-fav" onClickCapture={user ? undefined : guardarSemSessao}>
              <FavoriteButton larId={lar.id} larNome={lar.nome} variant="inline" />
            </span>
            {/* os contactos são do Acesso Família: na versão grátis o telefone não vai para o DOM */}
            {completo && lar.telefone && (
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
