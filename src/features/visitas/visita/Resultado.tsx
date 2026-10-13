import { useId } from 'react'
import { HeartHandshake, KeyRound } from 'lucide-react'
import type { Lar, PlanoInstituicao, ResultadoVisita } from '@/types'
import { ChoiceCard, InputField, Switch } from '@/components/ui/Field'
import { COMPROMISSO_MENSAL_MESES, compromissoAte, ENTRADAS_ANO_MENSAL_COMPENSA, PLANOS_INSTITUICAO, valorPlanoTexto } from '@/lib/acesso'
import { dataLonga, diaPorExtenso } from '@/lib/format'
import { cn } from '@/lib/cn'
import { maisDias, porEntradaBloqueada, precisaDeContacto, type ErrosVisita, type FormVisita } from '../formulario'
import { RESULTADO_LABEL } from '../pipeline'
import { RESULTADO_DOT, Secao } from '../ui'

const RESULTADOS: readonly ResultadoVisita[] = ['aderiu', 'interessado', 'voltar', 'recusou']
const PLANOS: readonly PlanoInstituicao[] = ['por_entrada', 'mensal']

/** Atalhos para o próximo contacto (um toque, sem abrir o calendário). */
const ATALHOS: { label: string; dias: number }[] = [
  { label: 'Amanhã', dias: 1 },
  { label: 'Daqui a 1 semana', dias: 7 },
  { label: 'Daqui a 2 semanas', dias: 14 },
  { label: 'Daqui a 1 mês', dias: 30 },
]

const ERRO = 'mt-2 text-sm font-medium text-alert-700'

/**
 * (f) Resultado: quatro opções sempre visíveis (2 × 2 no telemóvel, uma fila no desktop — numa fila deslizável a
 * última ficava fora do ecrã). Conforme a escolha: a modalidade (privados), "sem custos" (setor social), a conta do
 * responsável (quem ainda não tem) ou a data do próximo contacto.
 */
export function Resultado({
  lar,
  form,
  erros,
  agora,
  onResultado,
  onPlano,
  onCriarConta,
  onProximoContacto,
  focarEmail,
}: {
  lar: Lar
  form: FormVisita
  erros: ErrosVisita
  agora: Date
  onResultado: (r: ResultadoVisita) => void
  onPlano: (p: PlanoInstituicao) => void
  onCriarConta: (v: boolean) => void
  onProximoContacto: (ymd: string) => void
  focarEmail: () => void
}) {
  const id = useId()
  const r = form.resultado
  const privado = lar.natureza === 'privado'
  const bloqueada = porEntradaBloqueada(lar, agora)
  const ate = compromissoAte(lar)
  const email = form.responsavel.email.trim()
  const hoje = maisDias(agora, 0)
  const contactoValido = /^\d{4}-\d{2}-\d{2}$/.test(form.proximoContacto)

  return (
    <Secao id="resultado" titulo="Resultado" texto="Como ficou a conversa.">
      <fieldset data-campo="resultado" aria-describedby={erros.resultado ? `${id}-erro` : undefined}>
        <legend className="sr-only">Resultado da visita</legend>
        <div className="grid grid-cols-2 gap-1 rounded-[1.5rem] bg-sand p-1 sm:grid-cols-4">
          {RESULTADOS.map((x) => {
            const on = r === x
            return (
              <label
                key={x}
                className={cn(
                  'relative flex min-h-14 cursor-pointer items-center justify-center rounded-[1.25rem] px-2 text-center text-[0.9375rem] leading-tight font-medium select-none sm:px-3 sm:text-base',
                  'transition-[background-color,color,box-shadow,scale] duration-300 ease-[cubic-bezier(.16,1,.3,1)] active:scale-[0.98]',
                  'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terra-500',
                  on ? 'bg-white text-ink shadow-soft' : 'text-ink-mute hover:text-ink',
                )}
              >
                <input type="radio" name={`${id}-resultado`} value={x} checked={on} onChange={() => onResultado(x)} className="sr-only" />
                {/* o ponto acompanha a primeira linha quando o texto parte (ecrãs muito estreitos) */}
                <span>
                  <span aria-hidden className={cn('mr-2 inline-block size-2.5 rounded-full align-[0.08em] transition-opacity', RESULTADO_DOT[x], !on && 'opacity-60')} />
                  {RESULTADO_LABEL[x]}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>
      {erros.resultado && (
        <p id={`${id}-erro`} role="alert" className={ERRO}>
          {erros.resultado}
        </p>
      )}

      {r === 'aderiu' && privado && (
        <fieldset data-campo="plano" className="mt-8 motion-safe:animate-[fade-up_.5s_cubic-bezier(.16,1,.3,1)_both]" aria-describedby={`${id}-compensa`}>
          <legend className="text-lg font-semibold">Modalidade</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {PLANOS.map((p) => {
              const fechada = p === 'por_entrada' && bloqueada
              return (
                <ChoiceCard
                  key={p}
                  name={`${id}-plano`}
                  checked={form.plano === p}
                  onChange={() => onPlano(p)}
                  disabled={fechada}
                  className={cn(fechada && 'cursor-not-allowed opacity-55 active:scale-100')}
                  label={PLANOS_INSTITUICAO[p].nome}
                  description={
                    <>
                      <span className="mt-1 block text-base font-semibold text-ink tabular">{valorPlanoTexto(p)}</span>
                      <span className="mt-0.5 block">
                        {p === 'por_entrada' ? 'Só paga quando alguém entra.' : `Sem taxa por entrada · compromisso de ${COMPROMISSO_MENSAL_MESES} meses.`}
                      </span>
                    </>
                  }
                />
              )
            })}
          </div>
          <p id={`${id}-compensa`} className="mt-3 text-sm text-ink-mute">
            Mensalidade: compensa a partir de {ENTRADAS_ANO_MENSAL_COMPENSA} entradas por ano.
            {bloqueada && ate && <> Já está na mensalidade: «Por entrada» só a partir de {dataLonga(ate)}.</>}
          </p>
          {erros.plano && (
            <p role="alert" className={ERRO}>
              {erros.plano}
            </p>
          )}
        </fieldset>
      )}

      {r === 'aderiu' && !privado && (
        <p className="mt-8 flex items-center gap-3 rounded-[1.5rem] bg-sand px-5 py-4 text-ink-soft motion-safe:animate-[fade-up_.5s_cubic-bezier(.16,1,.3,1)_both]">
          <HeartHandshake aria-hidden className="size-5 shrink-0 text-ink-mute" />
          <span>
            <span className="font-semibold text-ink">Sem custos — setor social.</span> IPSS e Misericórdias não pagam nem escolhem modalidade.
          </span>
        </p>
      )}

      {r === 'aderiu' && !lar.ownerId && (
        <div className="mt-6 rounded-[1.5rem] px-5 py-3 ring-1 ring-line motion-safe:animate-[fade-up_.5s_cubic-bezier(.16,1,.3,1)_both]">
          <Switch
            checked={form.criarConta}
            onChange={onCriarConta}
            label="Criar a conta do responsável"
            description="Para gerir a ficha e as vagas no painel da instituição."
          />
          {form.criarConta && (
            <p aria-live="polite" className="mt-2 mb-1 flex items-center gap-2 text-sm leading-snug text-ink-soft">
              <KeyRound aria-hidden className="size-4 shrink-0 text-ink-mute" />
              {email ? (
                <span>
                  Conta para <span className="font-semibold break-all text-ink">{email}</span>. A palavra-passe provisória aparece no fim, uma só vez.
                </span>
              ) : (
                <span>
                  Falta o email do responsável.{' '}
                  <button type="button" onClick={focarEmail} className="link min-h-11 align-baseline">
                    Indicar o email
                  </button>
                </span>
              )}
            </p>
          )}
        </div>
      )}
      {r === 'aderiu' && lar.ownerId && <p className="mt-6 text-sm text-ink-mute">A instituição já tem conta: quem a gere continua com o mesmo acesso.</p>}

      {precisaDeContacto(r) && (
        <div data-campo="proximoContacto" className="mt-8 motion-safe:animate-[fade-up_.5s_cubic-bezier(.16,1,.3,1)_both]">
          <InputField
            label="Próximo contacto"
            type="date"
            min={hoje}
            value={form.proximoContacto}
            onChange={(e) => onProximoContacto(e.target.value)}
            error={erros.proximoContacto}
            hint={contactoValido ? diaPorExtenso(form.proximoContacto) : undefined}
            wrapperClassName="sm:max-w-xs"
          />
          <div role="group" aria-label="Atalhos para a data" className="mt-3 flex flex-wrap gap-2">
            {ATALHOS.map((a) => {
              const ymd = maisDias(agora, a.dias)
              const on = form.proximoContacto === ymd
              return (
                <button
                  key={a.dias}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onProximoContacto(ymd)}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-full px-4 text-[0.9375rem] font-medium transition-colors duration-200',
                    on ? 'bg-ink text-white' : 'bg-sand text-ink hover:bg-sand-deep',
                  )}
                >
                  {a.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </Secao>
  )
}
