import { useLocation, useNavigate } from 'react-router'
import { BellRing, CalendarDays, Phone, Send, Settings2 } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { FavoriteButton } from '@/components/lar/FavoriteButton'
import { calcadaStonesBg } from '@/components/brand/patterns'
import { setAlerta, useCurrentUser, useFavorito } from '@/lib/store'
import { pct, plural, tempoRelativo } from '@/lib/format'
import { QUARTO_CURTO } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { esperaEstimada, intervaloPreco, irParaSecao, precoSocial, telHref, type DadosLar } from './helpers'
import { CandidaturaAtiva } from './CandidaturaAtiva'

function Afirmacao({ lar, dados }: { lar: Lar; dados: DadosLar }) {
  const { livres, disp, unidade, centroDia } = dados
  if (livres > 0) {
    const tipos = lar.quartos.filter((q) => q.livres > 0).map((q) => QUARTO_CURTO[q.tipo].toLowerCase())
    return (
      <>
        <p className="font-display text-3xl leading-tight font-semibold text-white">
          <span className="mr-2 inline-block rounded-lg bg-sun-400 px-2.5 font-mono text-2xl leading-snug font-bold text-pine-950 tabular">{livres}</span>
          {livres === 1 ? `${unidade.um} livre` : `${unidade.varios} livres`} hoje
        </p>
        <p className="mt-2 text-sm text-pine-200">
          {centroDia ? 'Lugares de frequência diária' : `Em quarto ${tipos.join(' e ')}`}
          {lar.listaEspera > 0 ? ` · ${plural(lar.listaEspera, 'pessoa', 'pessoas')} em lista de espera.` : '. Sem lista de espera.'}
        </p>
      </>
    )
  }
  return (
    <>
      <p className="font-display text-3xl leading-tight font-semibold text-white">
        {disp === 'breve' ? (
          <>
            Sem vagas hoje, <em>em breve</em> provável
          </>
        ) : (
          <>
            Sem vagas hoje <span className="text-pine-300">·</span> <em>lista de espera</em>
          </>
        )}
      </p>
      <p className="mt-2 text-sm text-pine-200">
        {lar.listaEspera > 0
          ? `${plural(lar.listaEspera, 'pessoa inscrita', 'pessoas inscritas')} na lista de espera.`
          : 'Ninguém inscrito na lista de espera neste momento.'}
      </p>
    </>
  )
}

function TabelaCompacta({ lar, dados }: { lar: Lar; dados: DadosLar }) {
  const social = precoSocial(lar)
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Lugares e mensalidades por tipo de {dados.centroDia ? 'frequência' : 'quarto'}</caption>
      <thead>
        <tr className="text-left text-xs font-bold tracking-wide text-ink-mute uppercase">
          <th scope="col" className="pb-2 font-bold">{dados.centroDia ? 'Frequência' : 'Quarto'}</th>
          <th scope="col" className="pb-2 text-right font-bold">Mensalidade{social ? '*' : ''}</th>
          <th scope="col" className="pb-2 text-right font-bold">Livres</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line border-y border-line">
        {lar.quartos.map((q) => (
          <tr key={q.tipo}>
            <th scope="row" className="py-2 pr-2 text-left font-semibold text-ink">
              {dados.centroDia ? 'Diária' : QUARTO_CURTO[q.tipo]}
            </th>
            <td className="py-2 text-right font-display text-base font-semibold whitespace-nowrap text-ink tabular">{intervaloPreco(q.precoMin, q.precoMax)}</td>
            <td className="py-2 pl-3 text-right whitespace-nowrap tabular">
              <span className={cn('font-bold', q.livres > 0 ? 'text-leaf-700' : 'text-ink-mute')}>{q.livres}</span>
              <span className="text-ink-mute"> / {q.total}</span>
              <span className="sr-only"> {dados.centroDia ? 'lugares' : 'camas'} livres</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PrevisaoNovoPedido({ dados }: { dados: DadosLar }) {
  const { est, livres } = dados
  if (est.imediata) {
    return (
      <p className="rounded-2xl bg-leaf-50 px-4 py-3 text-sm text-leaf-700">
        <strong className="block text-base">Se pedir vaga hoje: há lugar livre.</strong>
        Ninguém na lista de espera está à sua frente para estes lugares.
      </p>
    )
  }
  const stat = (rotulo: string, p: number) => (
    <div className="flex-1">
      <dt className="text-xs font-bold tracking-wide text-ink-mute uppercase">{rotulo}</dt>
      <dd className="mt-0.5 font-display text-[1.75rem] leading-none font-semibold text-pine-800 tabular">{pct(p)}</dd>
      <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand-deep">
        <div className="h-full rounded-full bg-pine-600" style={{ width: `${Math.round(p * 100)}%` }} />
      </div>
    </div>
  )
  return (
    <div className="rounded-2xl border border-line bg-cream px-4 py-3.5">
      <p className="text-sm font-bold text-ink">Se pedir vaga hoje</p>
      <dl className="mt-2 flex gap-5">
        {stat('em 3 meses', est.p90)}
        {stat('em 6 meses', est.p180)}
      </dl>
      <p className="mt-2.5 text-sm leading-snug text-ink-soft">
        {livres > 0 && <>{livres === 1 ? 'O lugar livre deverá' : 'Os lugares livres deverão'} ir para quem já está na lista (≈ {est.listaEfetiva} à sua frente). </>}
        Espera estimada: <strong className="text-ink">{esperaEstimada(est)}</strong>.{' '}
        <button type="button" onClick={() => irParaSecao('ficha-previsao')} className="link text-sm">
          Como calculamos
        </button>
      </p>
    </div>
  )
}

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
  const social = precoSocial(lar)
  const ctaLabel = dados.livres > 0 ? 'Pedir vaga' : 'Inscrever-me na lista de espera'

  const alternarAlerta = (v: boolean) => {
    if (!user) {
      toast.info('Entre para receber alertas', 'Com uma conta gratuita avisamos por notificação quando abrir uma vaga.')
      navigate(`/entrar?voltar=${encodeURIComponent(location.pathname)}`)
      return
    }
    setAlerta(lar.id, v)
    if (v) toast.success('Alerta de vaga ativado', `Avisamos assim que ${lar.nome} indicar um lugar livre.`)
    else toast.info('Alerta desativado', 'Deixa de receber avisos de vaga desta instituição.')
  }

  return (
    <section aria-labelledby="vagas-titulo" className="overflow-hidden rounded-[1.75rem] border border-line bg-white shadow-lift">
      <div className="on-dark bg-pine-950 px-5 pt-5 pb-5 text-white xl:px-6" style={calcadaStonesBg('#ffffff', 0.04)}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="vagas-titulo" className="font-sans text-sm font-bold tracking-[0.14em] text-sun-200 uppercase">
            Vagas e preços
          </h2>
          <span className="flex items-center gap-2 text-xs text-pine-200">
            <span aria-hidden className="size-2 rounded-full bg-leaf-200" />
            {tempoRelativo(lar.atualizadoEm)}
          </span>
        </div>
        <div className="mt-3" aria-live="polite">
          <Afirmacao lar={lar} dados={dados} />
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5 xl:p-6">
        <div>
          <TabelaCompacta lar={lar} dados={dados} />
          {social && <p className="mt-2 text-xs leading-snug text-ink-mute">* Conforme os rendimentos. Ver “Preços”.</p>}
        </div>

        {ativa ? (
          <div ref={ctaRef}>
            <CandidaturaAtiva lar={lar} c={ativa} onVisita={() => onVisitaExistente(ativa)} />
          </div>
        ) : minhaFicha ? (
          <div ref={ctaRef} className="rounded-2xl border-2 border-dashed border-line-strong p-4">
            <p className="font-bold">Esta é a ficha da sua instituição.</p>
            <p className="mt-1 text-sm text-ink-soft">É assim que as famílias a veem. Mantenha as vagas atualizadas para aparecer primeiro.</p>
            <ButtonLink to="/gestao/ficha" variant="secondary" full className="mt-3" icon={<Settings2 aria-hidden className="size-5" />}>
              Editar ficha e vagas
            </ButtonLink>
          </div>
        ) : (
          <>
            <PrevisaoNovoPedido dados={dados} />
            <div ref={ctaRef} className="flex flex-col gap-3">
              <Button size="lg" full onClick={onPedir} icon={<Send aria-hidden className="size-5" />} className="whitespace-normal">
                {ctaLabel}
              </Button>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={onVisita} className="flex-1 px-3.5" icon={<CalendarDays aria-hidden className="size-5" />}>
                  Marcar visita
                </Button>
                <FavoriteButton larId={lar.id} larNome={lar.nome} variant="inline" className="grow justify-center px-3.5" />
              </div>
            </div>
          </>
        )}

        {ativa && <FavoriteButton larId={lar.id} larNome={lar.nome} variant="inline" className="justify-center" />}

        {!gestor && (
          <div className="rounded-2xl bg-sand px-4 py-1">
            <Switch
              checked={Boolean(fav?.alerta)}
              onChange={alternarAlerta}
              label={
                <span className="inline-flex items-center gap-2">
                  <BellRing aria-hidden className="size-4.5 text-terra-600" /> Avisar-me quando houver vaga
                </span>
              }
              description={user ? undefined : 'Precisa de uma conta gratuita.'}
            />
          </div>
        )}

        {lar.telefone && (
          <p className="flex flex-wrap items-center justify-between gap-x-2 border-t border-dashed border-line-strong pt-2 text-sm text-ink-soft">
            Prefere falar com alguém?
            <a href={telHref(lar.telefone)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-1 text-base font-bold text-pine-800 hover:underline">
              <Phone aria-hidden className="size-5" />
              <span className="tabular">{lar.telefone}</span>
            </a>
          </p>
        )}
      </div>
    </section>
  )
}
