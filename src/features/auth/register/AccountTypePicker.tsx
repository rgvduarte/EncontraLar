import { Building2, HeartHandshake } from 'lucide-react'
import type { Role } from '@/types'
import { ChoiceCard } from '@/components/ui/Field'

const OPCOES: { value: Role; label: string; description: string; Icon: typeof Building2 }[] = [
  {
    value: 'familia',
    label: 'Procuro lar para um familiar',
    description: 'Para filhos, netos e cuidadores. Guarde lares, envie pedidos de vaga e receba um aviso quando abrir lugar. Gratuito.',
    Icon: HeartHandshake,
  },
  {
    value: 'lar',
    label: 'Represento uma instituição',
    description: 'Lares (ERPI), residências seniores e centros de dia. Publique as vagas e receba pedidos já com o perfil de cuidados.',
    Icon: Building2,
  },
]

/** Passo 1: escolher o tipo de conta (dois cartões grandes, grupo de rádio nativo). */
export function AccountTypePicker({ value, onChange }: { value: Role | null; onChange: (r: Role) => void }) {
  return (
    <fieldset>
      <legend className="sr-only">Tipo de conta</legend>
      <div className="grid gap-4 md:grid-cols-2">
        {OPCOES.map(({ value: v, label, description, Icon }) => (
          <ChoiceCard
            key={v}
            name="tipo-conta"
            value={v}
            checked={value === v}
            onChange={() => onChange(v)}
            icon={<Icon aria-hidden />}
            label={<span className="font-display text-xl leading-tight font-semibold sm:text-2xl">{label}</span>}
            description={<span className="mt-1 block leading-relaxed">{description}</span>}
            className="p-5 sm:p-6 md:min-h-40 md:flex-col md:gap-4 md:[&>span:first-of-type]:size-13"
          />
        ))}
      </div>
    </fieldset>
  )
}
