import { useId, useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, CircleHelp, MapPin, ShieldQuestion, TriangleAlert } from 'lucide-react'
import type { Lar } from '@/types'
import { LarCover } from '@/components/lar/LarCover'
import { AvailabilityBadge, VerifiedBadge } from '@/components/lar/badges'
import { SeloVerificado } from '@/components/brand/SeloVerificado'
import { Stars } from '@/components/ui/Stars'
import { NATUREZA_DESCRICAO, NATUREZA_LABEL, TIPO_DESCRICAO, TIPO_LABEL } from '@/lib/labels'
import { plural, tempoRelativo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { dataHora, dividirNome, frescura, irParaSecao, type DadosLar } from './helpers'

export function Breadcrumbs({ lar }: { lar: Lar }) {
  const itens = [
    { to: '/', label: 'Início' },
    { to: '/pesquisa', label: 'Mapa de vagas' },
    { to: `/pesquisa?distrito=${encodeURIComponent(lar.distrito)}`, label: lar.distrito },
  ]
  return (
    <nav aria-label="Localização na página" className="text-sm">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-ink-soft">
        {itens.map((i) => (
          <li key={i.to} className="flex items-center gap-1.5">
            <Link to={i.to} className="rounded-md py-1 font-semibold underline-offset-4 hover:text-pine-800 hover:underline">
              {i.label}
            </Link>
            <ChevronRight aria-hidden className="size-4 text-ink-mute" />
          </li>
        ))}
        <li aria-current="page" className="max-w-full truncate py-1 text-ink">
          {lar.nome}
        </li>
      </ol>
    </nav>
  )
}

/** Faixa "vagas atualizadas há X" — o sinal de confiança mais importante da ficha. */
function Frescura({ lar }: { lar: Lar }) {
  const f = frescura(lar.atualizadoEm)
  return (
    <div
      className={cn(
        'inline-flex max-w-full items-start gap-3 rounded-2xl border px-4 py-3',
        f === 'antiga' ? 'border-sun-200 bg-sun-50' : 'border-line bg-white/80',
      )}
    >
      {f === 'antiga' ? (
        <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-sun-700" />
      ) : (
        <span aria-hidden className="relative mt-2 flex size-2.5 shrink-0">
          {f === 'recente' && <span className="absolute inline-flex size-full animate-ping rounded-full bg-leaf-500 opacity-60 motion-reduce:hidden" />}
          <span className={cn('relative inline-flex size-2.5 rounded-full', f === 'recente' ? 'bg-leaf-500' : 'bg-ink-mute')} />
        </span>
      )}
      <p className="text-base leading-snug">
        <strong className="font-bold text-ink">Vagas atualizadas pela instituição {tempoRelativo(lar.atualizadoEm)}</strong>
        <span className="block text-sm text-ink-soft">
          {f === 'antiga'
            ? 'Há mais de um mês sem atualização — confirme as vagas por telefone antes de decidir.'
            : `Última confirmação a ${dataHora(lar.atualizadoEm)}.`}
        </span>
      </p>
    </div>
  )
}

export function LarHero({ lar, dados }: { lar: Lar; dados: DadosLar }) {
  const { prefixo, nucleo } = dividirNome(lar.nome)
  const [explicar, setExplicar] = useState(false)
  const explicaId = useId()
  const verificado = lar.verificacao.estado === 'verificado'
  const anoSelo = lar.verificacao.data ? new Date(lar.verificacao.data).getFullYear() : undefined

  return (
    <header className="relative">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="eyebrow">
          {TIPO_LABEL[lar.tipo]} <span aria-hidden className="mx-1 text-terra-500">·</span> {NATUREZA_LABEL[lar.natureza]}
        </p>
        <button
          type="button"
          aria-expanded={explicar}
          aria-controls={explicaId}
          onClick={() => setExplicar((v) => !v)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-pine-700 underline decoration-pine-300 decoration-2 underline-offset-4 hover:text-pine-900"
        >
          <CircleHelp aria-hidden className="size-4" />
          {explicar ? 'Esconder explicação' : 'O que significa?'}
        </button>
      </div>
      <div id={explicaId} hidden={!explicar} className="mt-3 max-w-2xl animate-fade-in">
        <dl className="grid gap-4 rounded-2xl border border-line bg-white p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-bold text-ink">{TIPO_LABEL[lar.tipo]}</dt>
            <dd className="mt-1 text-ink-soft">{TIPO_DESCRICAO[lar.tipo]}</dd>
          </div>
          <div>
            <dt className="font-bold text-ink">{NATUREZA_LABEL[lar.natureza]}</dt>
            <dd className="mt-1 text-ink-soft">{NATUREZA_DESCRICAO[lar.natureza]}</dd>
          </div>
        </dl>
      </div>

      <h1 className="mt-4 font-semibold text-ink">
        {prefixo && (
          <>
            <em className="block font-display text-2xl leading-tight sm:text-3xl">{prefixo}</em>{' '}
          </>
        )}
        <span className="block text-4xl leading-[1.04] sm:text-5xl xl:text-6xl">{nucleo}</span>
      </h1>

      {lar.resumo && <p className="mt-4 max-w-2xl font-display text-xl leading-snug text-ink-soft sm:text-2xl">{lar.resumo}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-base">
        <p className="flex items-center gap-2 text-ink">
          <MapPin aria-hidden className="size-5 shrink-0 text-terra-600" />
          <span>
            {lar.morada ? `${lar.morada}, ` : ''}
            {lar.codigoPostal} {lar.localidade}
          </span>
        </p>
        {lar.numAvaliacoes > 0 ? (
          <button
            type="button"
            onClick={() => irParaSecao('ficha-avaliacoes')}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg hover:underline"
          >
            <Stars value={lar.avaliacao} size="md" />
            <span className="font-bold tabular">{lar.avaliacao.toLocaleString('pt-PT', { minimumFractionDigits: 1 })}</span>
            <span className="text-ink-soft">({plural(lar.numAvaliacoes, 'avaliação', 'avaliações')})</span>
          </button>
        ) : (
          <span className="text-ink-soft">Ainda sem avaliações</span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <AvailabilityBadge lar={lar} estado={dados.disp} size="md" />
        {verificado ? (
          <VerifiedBadge lar={lar} size="md" />
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-sand px-3.5 py-1 text-sm font-bold text-ink-soft">
            <ShieldQuestion aria-hidden className="size-4" />
            {lar.verificacao.estado === 'pendente' ? 'Verificação em curso' : 'Ainda não verificada'}
          </span>
        )}
      </div>

      <div className="mt-5">
        <Frescura lar={lar} />
      </div>

      <figure className="relative mt-10 before:absolute before:-inset-x-[100vw] before:-top-[120rem] before:bottom-1/2 before:-z-10 before:bg-sand before:content-['']">
        <div className="relative rounded-[1.9rem] border border-line bg-white p-2 shadow-card">
          <div className="relative aspect-[16/10] overflow-hidden rounded-[1.5rem] bg-sand sm:aspect-[2/1]">
            <LarCover hue={lar.capa.hue} variante={lar.capa.variante} />
          </div>
        </div>
        {verificado && (
          <div className="absolute -top-8 right-3 rounded-full bg-cream/95 p-1.5 shadow-soft sm:-top-10 sm:-right-5">
            <SeloVerificado ano={anoSelo} size={104} className="hidden sm:block" />
            <SeloVerificado ano={anoSelo} size={76} className="sm:hidden" />
          </div>
        )}
        <figcaption className="mt-3 flex flex-wrap justify-between gap-x-6 gap-y-1 px-1 text-sm text-ink-mute">
          <span className="italic">Ilustração — fotografias em breve</span>
          <span>
            {lar.localidade}
            {lar.fundacao ? ` · desde ${lar.fundacao}` : ''}
            {lar.capacidade ? ` · ${plural(lar.capacidade, 'lugar', 'lugares')}` : ''}
          </span>
        </figcaption>
      </figure>
    </header>
  )
}
