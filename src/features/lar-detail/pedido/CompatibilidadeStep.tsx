import { useMemo } from 'react'
import { Link } from 'react-router'
import { Check, ChevronRight, Minus, X } from 'lucide-react'
import type { Candidatura, Lar, PerfilIdoso } from '@/types'
import { ChoiceCard } from '@/components/ui/Field'
import { Meter } from '@/components/ui/misc'
import { avaliarLar, scoreLabel, type TipoRazao } from '@/lib/matching'
import { ESTADO_CANDIDATURA_LABEL, GRAU_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { Cascata, Contador } from '../motion'

const RAZAO: Record<TipoRazao, { Icon: typeof Check; cor: string; sr: string }> = {
  ok: { Icon: Check, cor: 'text-leaf-600', sr: 'Cumpre:' },
  parcial: { Icon: Minus, cor: 'text-sun-700', sr: 'Em parte:' },
  falta: { Icon: X, cor: 'text-alert-600', sr: 'Não cumpre:' },
}

export function CompatibilidadeStep({
  lar,
  perfis,
  perfil,
  onEscolher,
  ativas,
  onNovoPerfil,
}: {
  lar: Lar
  perfis: PerfilIdoso[]
  perfil: PerfilIdoso
  onEscolher: (id: string) => void
  /** candidaturas ativas nesta instituição, por perfil */
  ativas: Map<string, Candidatura>
  onNovoPerfil: () => void
}) {
  const m = useMemo(() => avaliarLar(lar, perfil), [lar, perfil])
  const jaPedido = ativas.get(perfil.id)
  const primeiroNome = perfil.nome.split(' ')[0]
  const tom = m.score >= 70 ? 'leaf' : m.score >= 50 ? 'sun' : 'dusk'
  const outraPessoa = (
    <button type="button" onClick={onNovoPerfil} className="inline-flex min-h-12 items-center gap-0.5 text-terra-600 hover:underline">
      Outra pessoa
      <ChevronRight aria-hidden className="size-4.5" />
    </button>
  )

  return (
    <div className="flex flex-col gap-8">
      {perfis.length > 1 ? (
        <fieldset>
          <legend className="text-base font-medium text-ink">Para quem é o pedido?</legend>
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
                  description={`${p.relacao} · ${GRAU_LABEL[p.grau]}${a ? ' · já tem pedido aqui' : ''}`}
                />
              )
            })}
          </div>
          {outraPessoa}
        </fieldset>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 border-b border-line pb-2">
          <p className="py-2 text-ink">
            <span className="font-medium">
              {perfil.nome}, {perfil.idade} anos
            </span>
            <span className="text-ink-mute"> · {GRAU_LABEL[perfil.grau]}</span>
          </p>
          {outraPessoa}
        </div>
      )}

      {jaPedido && (
        <p className="-mt-2 rounded-2xl bg-sand px-5 py-4 text-ink" aria-live="polite">
          <span className="font-semibold">Já fez um pedido para {primeiroNome} aqui.</span>{' '}
          <span className="text-ink-mute">Estado: {ESTADO_CANDIDATURA_LABEL[jaPedido.estado].toLowerCase()}. Não é preciso repetir.</span>
        </p>
      )}

      <section aria-labelledby="compat-titulo" aria-live="polite">
        <p className="text-sm text-ink-mute">Compatibilidade com {primeiroNome}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4">
          {/* o número conta e a barra enche ao abrir o passo (e ao trocar de pessoa) */}
          <p key={perfil.id} className="text-6xl font-semibold tracking-tight text-ink tabular">
            <Contador valor={m.score} />%
          </p>
          <h3 id="compat-titulo" className="text-xl font-semibold tracking-tight">
            {scoreLabel(m.score)}
          </h3>
        </div>
        <div key={`medidor-${perfil.id}`} className="ficha-medidor mt-4">
          <Meter value={m.score / 100} tone={tom} label={`Compatibilidade: ${m.score}%`} />
        </div>

        {!m.compativel && (
          <p role="alert" className="mt-5 text-alert-700">
            <span className="font-semibold">Pode não ter condições para {primeiroNome}:</span> falha um requisito essencial. Pode enviar na mesma — a
            equipa técnica avalia cada caso.
          </p>
        )}

        <Cascata key={`razoes-${perfil.id}`} passo={60} className="mt-6 border-t border-line">
          {m.razoes.map((r) => {
            const { Icon, cor, sr } = RAZAO[r.tipo]
            return (
              <li key={r.texto} className="flex items-start gap-3 border-b border-line py-3 text-ink">
                <Icon aria-hidden className={cn('mt-1 size-4.5 shrink-0', cor)} strokeWidth={2.5} />
                <span>
                  <span className="sr-only">{sr} </span>
                  {r.texto}
                </span>
              </li>
            )
          })}
        </Cascata>
        <p className="mt-4 text-sm text-ink-mute">
          Calculada com o perfil: cuidados, orçamento, distância, vagas e preferências.{' '}
          <Link to="/familia/perfil" className="text-terra-600 hover:underline">
            Editar o perfil
          </Link>
        </p>
      </section>

    </div>
  )
}
