import { ShieldCheck } from 'lucide-react'
import type { Natureza, TipoResposta } from '@/types'
import { InputField, SelectField } from '@/components/ui/Field'
import { NATUREZA_LABEL, TIPO_LABEL } from '@/lib/labels'
import { Appear } from '../shared/Appear'
import { LugarCombobox } from './LugarCombobox'
import type { InstForm } from './institutionSchema'

const TIPOS = Object.keys(TIPO_LABEL) as TipoResposta[]
const NATUREZAS = Object.keys(NATUREZA_LABEL) as Natureza[]

/**
 * Passo "Instituição" do registo: o essencial para aparecer no mapa. O resto completa-se no painel.
 * Os campos que ficam abaixo da dobra entram suavemente quando se chega a eles.
 */
export function InstituicaoFields({ form }: { form: InstForm }) {
  const lugar = form.field('lugar')

  return (
    <div className="flex flex-col gap-5">
      <Appear variant="up">
        <InputField {...form.field('instNome')} label="Nome da instituição" autoComplete="organization" autoCapitalize="words" enterKeyHint="next" />
      </Appear>

      <Appear variant="up">
        <SelectField {...form.field('tipo')} label="Tipo">
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {TIPO_LABEL[t]}
            </option>
          ))}
        </SelectField>
      </Appear>

      <Appear variant="up">
        <SelectField {...form.field('natureza')} label="Natureza">
          <option value="">Escolha uma opção</option>
          {NATUREZAS.map((n) => (
            <option key={n} value={n}>
              {NATUREZA_LABEL[n]}
            </option>
          ))}
        </SelectField>
      </Appear>

      <Appear variant="up">
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
      </Appear>

      <Appear variant="up">
        <InputField {...form.field('morada')} label="Morada" autoComplete="address-line1" enterKeyHint="next" />
      </Appear>

      <Appear variant="up" className="grid gap-5 sm:grid-cols-2">
        <InputField {...form.field('capacidade')} label="Lugares" inputMode="numeric" autoComplete="off" enterKeyHint="next" />
        <InputField {...form.field('precoDesde')} label="Mensalidade desde (€)" inputMode="numeric" autoComplete="off" enterKeyHint="next" />
      </Appear>

      <Appear variant="up">
        <InputField
          {...form.field('licenca')}
          label="N.º do alvará ou licença"
          hint="Emitido pela Segurança Social."
          autoComplete="off"
          autoCapitalize="characters"
          enterKeyHint="next"
        />
      </Appear>

      <Appear variant="up">
        <p className="flex gap-2.5 text-sm text-ink-mute">
          <ShieldCheck aria-hidden className="mt-0.5 size-4.5 shrink-0" />
          <span>
            Validamos o alvará e visitamos a instituição. Até lá, a ficha mostra «verificação em curso», mas já pode publicar vagas.
          </span>
        </p>
      </Appear>
    </div>
  )
}
