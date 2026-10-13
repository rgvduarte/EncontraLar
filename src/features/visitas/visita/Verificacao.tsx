import { Check } from 'lucide-react'
import type { Lar, Visita } from '@/types'
import { InputField, Switch } from '@/components/ui/Field'
import { SeloVerificado } from '@/components/brand/SeloVerificado'
import { niveisVerificacao } from '@/lib/negocio'
import { cn } from '@/lib/cn'
import { Secao } from '../ui'

type Chave = keyof Visita['verificacao']

/** Uma parte da "conta" do selo: visto ou círculo vazio, e o estado em texto para o leitor de ecrã. */
function Parte({ ok, estado, children }: { ok: boolean; estado: [sim: string, nao: string]; children: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium', ok ? 'text-ink' : 'text-ink-mute')}>
      {ok ? (
        <span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-terra-600 text-white">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      ) : (
        <span aria-hidden className="size-5 rounded-full border-[1.5px] border-pine-400" />
      )}
      {children}
      <span className="sr-only"> ({ok ? estado[0] : estado[1]})</span>
    </span>
  )
}

/** Licença + instalações = selo «Visitada pela equipa», em direto. */
function SeloAoVivo({ lar, licenca, instalacoes }: { lar: Lar; licenca: boolean; instalacoes: boolean }) {
  const ambos = licenca && instalacoes
  const jaTinha = niveisVerificacao(lar).visitado
  const falta = !licenca && !instalacoes ? 'Confirme a licença e as instalações.' : !licenca ? 'Falta confirmar a licença.' : !instalacoes ? 'Falta ver as instalações.' : null
  return (
    <div className={cn('mt-5 flex items-center gap-4 rounded-[1.5rem] p-5 transition-colors duration-300', ambos ? 'bg-terra-50' : 'bg-sand')}>
      <span aria-hidden className={cn('shrink-0 transition-[opacity,filter,scale] duration-500 ease-[cubic-bezier(.16,1,.3,1)]', ambos ? 'scale-100 opacity-100' : 'scale-90 opacity-35 grayscale')}>
        <SeloVerificado size={52} />
      </span>
      <div className="min-w-0" aria-live="polite">
        <p className="font-semibold leading-snug">
          {ambos ? (jaTinha ? 'Renova o selo «Visitada pela equipa»' : 'Fica com o selo «Visitada pela equipa»') : 'Selo «Visitada pela equipa»'}
        </p>
        <p className="relative mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.9375rem]">
          <Parte ok={licenca} estado={['confirmada', 'por confirmar']}>
            Licença
          </Parte>
          <span aria-hidden className="text-ink-mute">+</span>
          <span className="sr-only">mais</span>
          <Parte ok={instalacoes} estado={['vistas', 'por ver']}>
            Instalações
          </Parte>
          <span aria-hidden className="text-ink-mute">=</span>
          <span className="sr-only">igual a</span>
          <span className={ambos ? 'font-semibold text-terra-700' : 'text-ink-mute'}>selo</span>
        </p>
        {falta && <p className="mt-1 text-sm text-ink-mute">{falta}</p>}
      </div>
    </div>
  )
}

/** (b) Verificação: quatro interruptores; a licença traz o número da ficha para conferir. */
export function Verificacao({
  lar,
  verificacao,
  licenca,
  onVerificacao,
  onLicenca,
}: {
  lar: Lar
  verificacao: Visita['verificacao']
  licenca: string
  onVerificacao: (k: Chave, v: boolean) => void
  onLicenca: (v: string) => void
}) {
  const naFicha = lar.verificacao.licenca
  return (
    <Secao id="verificacao" titulo="Verificação" texto="Só o que confirmou na visita.">
      <div className="divide-y divide-line rounded-[1.5rem] px-5 ring-1 ring-line">
        <div className="py-3">
          <Switch
            checked={verificacao.licencaConfirmada}
            onChange={(v) => onVerificacao('licencaConfirmada', v)}
            label="Licença confirmada"
            description={naFicha ? `Na ficha: n.º ${naFicha}` : 'A ficha ainda não tem o número.'}
          />
          {verificacao.licencaConfirmada && (
            <InputField
              label="N.º da licença"
              hint="Como está no alvará. Corrija se for diferente."
              value={licenca}
              onChange={(e) => onLicenca(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={40}
              wrapperClassName="mt-3 mb-2 motion-safe:animate-[pop-in_.3s_cubic-bezier(.16,1,.3,1)_both] sm:max-w-sm"
            />
          )}
        </div>
        <Switch
          className="py-3"
          checked={verificacao.instalacoesVistas}
          onChange={(v) => onVerificacao('instalacoesVistas', v)}
          label="Instalações vistas"
          description="Quartos, espaços comuns e cozinha."
        />
        <Switch
          className="py-3"
          checked={verificacao.vagasConfirmadas}
          onChange={(v) => onVerificacao('vagasConfirmadas', v)}
          label="Vagas confirmadas"
          description="Atualiza os lugares livres na ficha."
        />
        <Switch
          className="py-3"
          checked={verificacao.precosConfirmados}
          onChange={(v) => onVerificacao('precosConfirmados', v)}
          label="Preços confirmados"
          description="Atualiza as mensalidades na ficha."
        />
      </div>
      <SeloAoVivo lar={lar} licenca={verificacao.licencaConfirmada} instalacoes={verificacao.instalacoesVistas} />
    </Secao>
  )
}
