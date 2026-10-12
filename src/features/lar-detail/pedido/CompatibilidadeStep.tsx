import { useMemo } from 'react'
import { Link } from 'react-router'
import { ArrowRight, CircleAlert, CircleCheck, CircleX, TriangleAlert, UserPlus } from 'lucide-react'
import type { Candidatura, Lar, PerfilIdoso } from '@/types'
import { ChoiceCard } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { avaliarLar, scoreLabel, type Razao, type TipoRazao } from '@/lib/matching'
import { ESTADO_CANDIDATURA_LABEL, GRAU_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'

const RAZAO: Record<TipoRazao, { Icon: typeof CircleCheck; cor: string; titulo: string; sr: string }> = {
  ok: { Icon: CircleCheck, cor: 'text-leaf-600', titulo: 'Cumpre', sr: 'Cumpre:' },
  parcial: { Icon: CircleAlert, cor: 'text-sun-700', titulo: 'Em parte', sr: 'Em parte:' },
  falta: { Icon: CircleX, cor: 'text-alert-600', titulo: 'Não cumpre', sr: 'Não cumpre:' },
}

function ScoreRing({ score }: { score: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  const cor = score >= 70 ? '#2f8c4b' : score >= 50 ? '#dc9415' : '#b42318'
  return (
    <svg viewBox="0 0 80 80" className="size-24 shrink-0 -rotate-90" aria-hidden>
      <circle cx="40" cy="40" r={r} fill="none" stroke="#ebe0cf" strokeWidth="8" />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke={cor}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - score / 100)}
        className="transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  )
}

function ListaRazoes({ razoes }: { razoes: Razao[] }) {
  const grupos = (['ok', 'parcial', 'falta'] as TipoRazao[]).map((t) => ({ t, itens: razoes.filter((r) => r.tipo === t) })).filter((g) => g.itens.length)
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {grupos.map(({ t, itens }) => {
        const { Icon, cor, titulo, sr } = RAZAO[t]
        return (
          <div key={t} className={cn(t === 'ok' && grupos.length > 1 && 'sm:row-span-2')}>
            <p className={cn('text-xs font-bold tracking-[0.12em] uppercase', cor)}>{titulo}</p>
            <ul className="mt-2 space-y-2">
              {itens.map((r) => (
                <li key={r.texto} className="flex gap-2.5 text-ink">
                  <Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', cor)} />
                  <span>
                    <span className="sr-only">{sr} </span>
                    {r.texto}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

export function CompatibilidadeStep({
  lar,
  perfis,
  perfilId,
  onEscolher,
  ativas,
  onNovoPerfil,
}: {
  lar: Lar
  perfis: PerfilIdoso[]
  perfilId: string
  onEscolher: (id: string) => void
  /** candidaturas ativas nesta instituição, por perfil */
  ativas: Map<string, Candidatura>
  onNovoPerfil: () => void
}) {
  const perfil = perfis.find((p) => p.id === perfilId) ?? perfis[0]!
  const m = useMemo(() => avaliarLar(lar, perfil), [lar, perfil])
  const jaPedido = ativas.get(perfil.id)
  const primeiroNome = perfil.nome.split(' ')[0]

  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="text-base font-bold text-ink">Para quem é o pedido?</legend>
        <div className="mt-3 grid gap-3">
          {perfis.map((p) => {
            const a = ativas.get(p.id)
            return (
              <ChoiceCard
                key={p.id}
                name="pedido-perfil"
                value={p.id}
                checked={p.id === perfil.id}
                onChange={() => onEscolher(p.id)}
                label={`${p.nome}, ${p.idade} anos`}
                description={`${p.relacao} · ${GRAU_LABEL[p.grau]}${a ? ` · Já tem pedido aqui (${ESTADO_CANDIDATURA_LABEL[a.estado].toLowerCase()})` : ''}`}
              />
            )
          })}
        </div>
        <Button variant="ghost" size="sm" className="mt-2" onClick={onNovoPerfil} icon={<UserPlus aria-hidden className="size-4.5" />}>
          Criar perfil para outra pessoa
        </Button>
      </fieldset>

      <section aria-labelledby="compat-titulo" aria-live="polite" className="rounded-3xl border border-line bg-white p-5 sm:p-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            <ScoreRing score={m.score} />
            <span className="absolute inset-0 flex items-center justify-center font-display text-2xl font-semibold text-ink tabular">
              {m.score}
              <span className="text-sm">%</span>
            </span>
          </div>
          <div>
            <p className="text-xs font-bold tracking-[0.12em] text-ink-mute uppercase">Compatibilidade com {primeiroNome}</p>
            <h3 id="compat-titulo" className="mt-1 text-2xl font-semibold">
              {scoreLabel(m.score)}
            </h3>
            <p className="mt-1 text-sm text-ink-soft">Calculada com o perfil: cuidados, orçamento, distância, vagas e preferências.</p>
          </div>
        </div>

        {!m.compativel && (
          <div role="alert" className="mt-5 flex gap-3 rounded-2xl border border-alert-600/30 bg-alert-50 p-4 text-alert-700">
            <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
            <p className="text-sm">
              <strong className="block text-base">Esta instituição pode não ter condições para {primeiroNome}.</strong>
              Falha pelo menos um requisito essencial (assinalado abaixo). Pode enviar o pedido na mesma — a equipa técnica avalia cada caso e responde.
            </p>
          </div>
        )}

        <div className="mt-5 border-t border-line pt-5">
          <ListaRazoes razoes={m.razoes} />
        </div>
        <p className="mt-5 text-sm text-ink-soft">
          Algo não está certo?{' '}
          <Link to="/familia/perfil" className="link text-sm">
            Editar o perfil
          </Link>
        </p>
      </section>

      {jaPedido && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-pine-200 bg-pine-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink">
            <strong>Já fez um pedido para {primeiroNome} nesta instituição</strong>
            <span className="block text-sm text-ink-soft">Estado: {ESTADO_CANDIDATURA_LABEL[jaPedido.estado]}. Não é preciso repetir.</span>
          </p>
          <Link to="/familia/pedidos" className="link inline-flex shrink-0 items-center gap-1.5">
            Ver pedido <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      )}
    </div>
  )
}
