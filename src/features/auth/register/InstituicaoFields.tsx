import { Building2, Euro, FileBadge, Home, Users } from 'lucide-react'
import type { TipoResposta } from '@/types'
import { ChoiceCard, InputField, SelectField } from '@/components/ui/Field'
import { SeloVerificado } from '@/components/brand/SeloVerificado'
import { NATUREZA_DESCRICAO, NATUREZA_LABEL, TIPO_LABEL } from '@/lib/labels'
import { LugarCombobox } from './LugarCombobox'
import type { InstForm } from './institutionSchema'

const TIPOS: { value: TipoResposta; nota: string }[] = [
  { value: 'erpi', nota: 'Alojamento permanente ou temporário, com cuidados diários.' },
  { value: 'residencia', nota: 'Quartos ou apartamentos para pessoas sobretudo autónomas.' },
  { value: 'centro_dia', nota: 'Resposta diurna, com regresso a casa ao fim do dia.' },
]

const NATUREZAS = Object.keys(NATUREZA_LABEL) as (keyof typeof NATUREZA_LABEL)[]

/** Como funciona a verificação — explicado antes de pedir a licença. */
function VerificationNote() {
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-pine-200 bg-pine-50 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
      <SeloVerificado size={92} className="self-start sm:self-center" />
      <div>
        <p className="font-display text-xl font-semibold text-pine-900">Como verificamos a instituição</p>
        <p className="mt-2 text-ink">
          Validamos a licença emitida pela Segurança Social e fazemos uma visita presencial. Até lá, a ficha aparece nas pesquisas como
          «verificação em curso» — já pode publicar vagas e receber pedidos.
        </p>
      </div>
    </div>
  )
}

/** Passo 3 do registo de instituição: dados da instituição. */
export function InstituicaoFields({ form }: { form: InstForm }) {
  const tipoErro = form.errorOf('tipo')
  const natureza = form.values.natureza as keyof typeof NATUREZA_LABEL | ''
  const lugar = form.field('lugar')

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <InputField
        {...form.field('instNome')}
        label="Nome da instituição"
        autoComplete="organization"
        leading={<Building2 />}
        placeholder="Ex.: Lar Nossa Senhora da Paz"
        wrapperClassName="sm:col-span-2"
      />

      <fieldset className="flex flex-col gap-3 sm:col-span-2" aria-describedby={tipoErro ? 'tipo-err' : undefined}>
        <legend className="mb-3 text-base font-bold text-ink">Tipo de resposta</legend>
        <div className="grid gap-3 md:grid-cols-3">
          {TIPOS.map((t) => (
            <ChoiceCard
              key={t.value}
              name="tipo"
              value={t.value}
              checked={form.values.tipo === t.value}
              onChange={() => form.setValue('tipo', t.value)}
              label={TIPO_LABEL[t.value]}
              description={t.nota}
              className="h-full"
            />
          ))}
        </div>
        {tipoErro && (
          <p id="tipo-err" role="alert" className="text-sm font-bold text-alert-700">
            {tipoErro}
          </p>
        )}
      </fieldset>

      <SelectField
        {...form.field('natureza')}
        label="Natureza"
        hint={natureza ? NATUREZA_DESCRICAO[natureza] : 'Ajuda as famílias a perceber como é calculada a mensalidade.'}
        wrapperClassName="sm:col-span-2"
      >
        <option value="">Escolha uma opção</option>
        {NATUREZAS.map((n) => (
          <option key={n} value={n}>
            {n === 'privado' ? 'Privada (com fins lucrativos)' : NATUREZA_LABEL[n]}
          </option>
        ))}
      </SelectField>

      <LugarCombobox
        ref={lugar.ref}
        name={lugar.name}
        value={lugar.value}
        error={lugar.error}
        onChange={(v) => form.setValue('lugar', v)}
        onBlur={lugar.onBlur}
        label="Localidade"
        hint="Concelho ou zona da cidade."
      />
      <InputField
        {...form.field('morada')}
        label="Morada"
        autoComplete="street-address"
        leading={<Home />}
        hint="Rua e número, para a visita."
        placeholder="Ex.: Rua das Camélias, 128"
      />

      <InputField
        {...form.field('capacidade')}
        label="Capacidade licenciada"
        inputMode="numeric"
        leading={<Users />}
        hint="Número total de lugares."
        placeholder="Ex.: 40"
      />
      <InputField
        {...form.field('precoDesde')}
        label="Mensalidade desde"
        inputMode="numeric"
        leading={<Euro />}
        hint="Valor mais baixo, por pessoa e por mês."
        placeholder="Ex.: 1250"
      />

      <InputField
        {...form.field('licenca')}
        label="N.º do alvará ou licença de funcionamento"
        leading={<FileBadge />}
        hint="Emitida pelo Instituto da Segurança Social, por exemplo 217/2009."
        wrapperClassName="sm:col-span-2"
      />

      <div className="sm:col-span-2">
        <VerificationNote />
      </div>
    </div>
  )
}
