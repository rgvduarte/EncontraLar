import { InputField } from '@/components/ui/Field'
import type { ResponsavelForm } from '../formulario'
import { Secao } from '../ui'

/** (e) Com quem falou: nome, cargo, telefone e email (o email é o da conta, se a criar). */
export function Responsavel({
  responsavel,
  erroEmail,
  emailNecessario,
  onChange,
}: {
  responsavel: ResponsavelForm
  erroEmail?: string
  /** a conta vai ser criada: o email passa a ser preciso */
  emailNecessario: boolean
  onChange: (k: keyof ResponsavelForm, v: string) => void
}) {
  return (
    <Secao id="responsavel" titulo="Responsável" texto="Com quem falou. Fica só para a equipa (e para a conta, se a criar).">
      <div className="grid gap-5 sm:grid-cols-2">
        {/* autoComplete off: são os dados de outra pessoa, não os de quem preenche */}
        <InputField label="Nome" value={responsavel.nome} onChange={(e) => onChange('nome', e.target.value)} autoComplete="off" autoCapitalize="words" maxLength={80} />
        <InputField
          label="Cargo"
          placeholder="Ex.: diretora técnica"
          value={responsavel.cargo}
          onChange={(e) => onChange('cargo', e.target.value)}
          autoComplete="off"
          maxLength={60}
        />
        <InputField
          label="Telefone"
          type="tel"
          inputMode="tel"
          value={responsavel.telefone}
          onChange={(e) => onChange('telefone', e.target.value)}
          autoComplete="off"
          maxLength={20}
        />
        <div data-campo="email">
          <InputField
            label="Email"
            type="email"
            inputMode="email"
            hint={emailNecessario ? 'Para criar a conta do responsável.' : undefined}
            value={responsavel.email}
            onChange={(e) => onChange('email', e.target.value)}
            error={erroEmail}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={120}
          />
        </div>
      </div>
    </Secao>
  )
}
