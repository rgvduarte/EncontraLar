/**
 * Pedaços de UI real para a grelha "Tudo o que precisa para decidir" — dados verdadeiros do store,
 * compostos como capturas do produto.
 *
 * Versão grátis (sem Acesso Família): a previsão e a compatibilidade aparecem como exemplos sem nome (nada as liga
 * a uma instituição), e o cartão de preços mostra a faixa de preço com o preço de cada quarto fechado.
 */
import { Link } from 'react-router'
import { Check, Lock, Minus, X } from 'lucide-react'
import type { Lar } from '@/types'
import { ForecastStrip } from '@/components/brand/ForecastStrip'
import { SeloVerificado } from '@/components/brand/SeloVerificado'
import { ACESSO_DISPONIVEL } from '@/components/acesso'
import { faixaPreco } from '@/lib/acesso'
import { resumoPrevisao } from '@/lib/forecast'
import { NATUREZA_LABEL, QUARTO_CURTO, TIPO_LABEL } from '@/lib/labels'
import { scoreLabel, type TipoRazao } from '@/lib/matching'
import { euro, num } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useMediaQuery } from '@/lib/hooks'
import { useInView } from '@/lib/motion'
import { razoesGratis, type ExemploMatch, type PrevisaoDestaque } from './homeData'

const cartao = 'rounded-[1.375rem] bg-white p-5 sm:p-7'

/** Nome da instituição como ligação discreta (o cartão é uma "captura", mas leva à ficha real). */
function NomeLar({ lar, className }: { lar: Lar; className?: string }) {
  return (
    <Link to={`/lar/${lar.id}`} className={cn('font-semibold text-ink hover:underline', className)}>
      {lar.nome}
    </Link>
  )
}

/** Linha "fechada" dentro de um cartão: o que o Acesso Família junta (sem nenhum valor por baixo). */
function Fechado({ titulo, className }: { titulo: string; className?: string }) {
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl bg-sand px-4 py-3.5', className)}>
      <Lock aria-hidden className="mt-1 size-4 shrink-0 text-ink-mute" />
      <p className="leading-snug">
        <span className="block font-medium text-ink">{titulo}</span>
        <span className="text-sm text-ink-mute">{ACESSO_DISPONIVEL}</span>
      </p>
    </div>
  )
}

// ————————————————————————————————————————— previsão

/**
 * Ao entrar no ecrã (com `animar`), cada mês aparece por ordem e a sua barra enche-se da esquerda para a direita
 * (scaleX — só transform). O ForecastStrip é partilhado: a animação é aplicada aqui, por seletores.
 */
const ENCHER = cn(
  '[&_li]:transition-[opacity,translate] [&_li]:duration-700 [&_li]:ease-[cubic-bezier(.16,1,.3,1)]',
  '[&_.h-1>span]:origin-left [&_.h-1>span]:transition-transform [&_.h-1>span]:duration-[900ms] [&_.h-1>span]:ease-[cubic-bezier(.16,1,.3,1)]',
  '[&_li:nth-child(2)]:delay-[90ms] [&_li:nth-child(3)]:delay-[180ms] [&_li:nth-child(4)]:delay-[270ms] [&_li:nth-child(5)]:delay-[360ms] [&_li:nth-child(6)]:delay-[450ms]',
  '[&_li:nth-child(2)_.h-1>span]:delay-[90ms] [&_li:nth-child(3)_.h-1>span]:delay-[180ms] [&_li:nth-child(4)_.h-1>span]:delay-[270ms] [&_li:nth-child(5)_.h-1>span]:delay-[360ms] [&_li:nth-child(6)_.h-1>span]:delay-[450ms]',
)
const VAZIO = '[&_li]:translate-y-3 [&_li]:opacity-0 [&_.h-1>span]:scale-x-0'

/**
 * `anonimo` (versão grátis): a mesma previsão, como exemplo sem nome nem ligação — mostra o que o Acesso Família
 * dá sem dizer de que instituição é.
 */
export function PrevisaoCard({
  previsao,
  agora,
  animar,
  anonimo,
}: {
  previsao: PrevisaoDestaque
  agora: number
  animar?: boolean
  anonimo?: boolean
}) {
  const { lar, est } = previsao
  // no telemóvel, três meses cabem numa linha; seis ficariam apertados
  const largo = useMediaQuery('(min-width: 640px)')
  const [ref, visto] = useInView<HTMLDivElement>({ threshold: 0.4 })
  return (
    <div ref={ref} className={cartao}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        {anonimo ? (
          <p className="leading-snug font-semibold text-ink">Exemplo: uma casa sem vaga hoje</p>
        ) : (
          <NomeLar lar={lar} className="leading-snug" />
        )}
        <p className="flex shrink-0 items-start gap-2 text-sm text-sun-800">
          <span aria-hidden className="mt-[0.45em] size-2 shrink-0 rounded-full bg-sun-500" />
          {resumoPrevisao(lar, est)}
        </p>
      </div>
      <ForecastStrip
        curva={est.curva}
        meses={largo ? 6 : 3}
        inicio={new Date(agora)}
        className={cn('mt-6', animar && ENCHER, animar && !visto && VAZIO)}
      />
      {anonimo && <Fechado titulo="A previsão de cada instituição" className="mt-6" />}
    </div>
  )
}

// ————————————————————————————————————————— preços

/** `completo` falso (versão grátis): a faixa de preço e o preço de cada quarto fechado (os valores não vão para o DOM). */
export function PrecosCard({ lar, completo = true }: { lar: Lar; completo?: boolean }) {
  if (!completo) {
    return (
      <div className={cartao}>
        <NomeLar lar={lar} className="block leading-snug" />
        <p className="text-sm text-ink-mute">
          {TIPO_LABEL[lar.tipo]} · {NATUREZA_LABEL[lar.natureza]} · {lar.localidade}
        </p>
        <dl className="mt-5 border-b border-line">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
            <dt className="text-ink-soft">Faixa de preço</dt>
            <dd className="font-semibold text-ink">{faixaPreco(lar)}</dd>
          </div>
        </dl>
        <Fechado titulo="Preço de cada quarto" className="mt-4" />
      </div>
    )
  }
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

/**
 * `anonimo` (versão grátis): sem o nome da instituição e só com as razões que a versão grátis também mostra
 * (cuidados e comodidades) — sem preço, distância nem vagas.
 */
export function MatchCard({ exemplo, anonimo }: { exemplo: ExemploMatch; anonimo?: boolean }) {
  const { lar, match, lugar } = exemplo
  const razoes = (anonimo ? razoesGratis(exemplo) : match.razoes).slice(0, 3)
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
          {!anonimo && <NomeLar lar={lar} className="mt-1 block font-normal text-ink-soft" />}
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
