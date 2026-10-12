/**
 * Pedaços de UI real para a grelha "Tudo o que precisa para decidir" — dados verdadeiros do store,
 * compostos como capturas do produto.
 */
import { Link } from 'react-router'
import { Check, Minus, X } from 'lucide-react'
import type { Lar } from '@/types'
import { ForecastStrip } from '@/components/brand/ForecastStrip'
import { SeloVerificado } from '@/components/brand/SeloVerificado'
import { resumoPrevisao } from '@/lib/forecast'
import { NATUREZA_LABEL, QUARTO_CURTO, TIPO_LABEL } from '@/lib/labels'
import { scoreLabel, type TipoRazao } from '@/lib/matching'
import { euro, num } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useMediaQuery } from '@/lib/hooks'
import type { ExemploMatch, PrevisaoDestaque } from './homeData'

const cartao = 'rounded-[1.375rem] bg-white p-5 sm:p-7'

/** Nome da instituição como ligação discreta (o cartão é uma "captura", mas leva à ficha real). */
function NomeLar({ lar, className }: { lar: Lar; className?: string }) {
  return (
    <Link to={`/lar/${lar.id}`} className={cn('font-semibold text-ink hover:underline', className)}>
      {lar.nome}
    </Link>
  )
}

// ————————————————————————————————————————— previsão

export function PrevisaoCard({ previsao, agora }: { previsao: PrevisaoDestaque; agora: number }) {
  const { lar, est } = previsao
  // no telemóvel, três meses cabem numa linha; seis ficariam apertados
  const largo = useMediaQuery('(min-width: 640px)')
  return (
    <div className={cartao}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <NomeLar lar={lar} className="leading-snug" />
        <p className="flex shrink-0 items-start gap-2 text-sm text-sun-800">
          <span aria-hidden className="mt-[0.45em] size-2 shrink-0 rounded-full bg-sun-500" />
          {resumoPrevisao(lar, est)}
        </p>
      </div>
      <ForecastStrip curva={est.curva} meses={largo ? 6 : 3} inicio={new Date(agora)} className="mt-6" />
    </div>
  )
}

// ————————————————————————————————————————— preços

export function PrecosCard({ lar }: { lar: Lar }) {
  return (
    <div className={cartao}>
      <NomeLar lar={lar} className="block leading-snug" />
      <p className="text-sm text-ink-mute">
        {TIPO_LABEL[lar.tipo]} · {NATUREZA_LABEL[lar.natureza]} · {lar.localidade}
      </p>
      <dl className="mt-5 divide-y divide-line">
        {lar.quartos.map((q) => (
          <div key={q.tipo} className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-ink-soft">{QUARTO_CURTO[q.tipo]}</dt>
            <dd className="font-semibold text-ink tabular">
              {q.precoMin === q.precoMax ? euro(q.precoMin) : `${num(q.precoMin)}–${euro(q.precoMax)}`}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-sm text-ink-mute">
        Por pessoa, por mês{lar.natureza !== 'privado' && ' · conforme rendimentos'}
      </p>
    </div>
  )
}

// ————————————————————————————————————————— verificação

const VERIFICACAO = ['Licença de funcionamento confirmada', 'Instalações visitadas pela equipa', 'Renovado todos os anos']

export function VerificacaoPeca({ verificadas, total }: { verificadas: number; total: number }) {
  return (
    <div className="flex flex-col gap-6">
      <SeloVerificado size={72} />
      <ul className="flex flex-col gap-3">
        {VERIFICACAO.map((t) => (
          <li key={t} className="flex items-start gap-3 text-ink-soft">
            <Check aria-hidden className="mt-1 size-4.5 shrink-0 text-terra-600" strokeWidth={2.5} />
            {t}
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-mute">
        <span className="font-semibold text-ink tabular">{num(verificadas)}</span> de {num(total)} instituições já verificadas.
      </p>
    </div>
  )
}

// ————————————————————————————————————————— compatibilidade

/** "do Porto", "de Lisboa" */
const deLugar = (nome: string) => (nome === 'Porto' ? 'do Porto' : `de ${nome}`)

const RAZAO: Record<TipoRazao, { Icon: typeof Check; cor: string; sr: string }> = {
  ok: { Icon: Check, cor: 'text-leaf-600', sr: 'Cumpre' },
  parcial: { Icon: Minus, cor: 'text-sun-700', sr: 'Em parte' },
  falta: { Icon: X, cor: 'text-alert-600', sr: 'Não cumpre' },
}

function Anel({ score }: { score: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 120 120" className="size-24 shrink-0 -rotate-90 sm:size-32" aria-hidden>
      <circle cx="60" cy="60" r={r} fill="none" strokeWidth="9" className="stroke-sand-deep" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - score / 100)}
        className="stroke-terra-600"
      />
    </svg>
  )
}

export function MatchCard({ exemplo }: { exemplo: ExemploMatch }) {
  const { lar, match, lugar } = exemplo
  const razoes = match.razoes.slice(0, 3)
  return (
    <div className={cn(cartao, 'w-full')}>
      <p className="text-sm text-ink-mute">Exemplo: dependência moderada, demência, perto {deLugar(lugar.label)}</p>
      <div className="mt-5 flex items-center gap-4 sm:gap-6">
        <div className="relative">
          <Anel score={match.score} />
          <span className="absolute inset-0 flex items-center justify-center text-2xl font-semibold tracking-tight text-ink tabular sm:text-3xl">
            {match.score}%
          </span>
        </div>
        <div className="min-w-0 leading-snug">
          <p className="font-semibold text-ink">{scoreLabel(match.score)}</p>
          <NomeLar lar={lar} className="mt-1 block font-normal text-ink-soft" />
        </div>
      </div>
      <ul className="mt-6 flex flex-col gap-2.5">
        {razoes.map((r) => {
          const { Icon, cor, sr } = RAZAO[r.tipo]
          return (
            <li key={r.texto} className="flex items-start gap-3 text-ink-soft">
              <Icon aria-hidden className={cn('mt-1 size-4.5 shrink-0', cor)} strokeWidth={2.5} />
              <span>
                <span className="sr-only">{sr}: </span>
                {r.texto}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
