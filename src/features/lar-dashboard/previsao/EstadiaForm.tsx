import { useState, type FormEvent } from 'react'
import type { Lar } from '@/types'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { atualizarLar } from '@/lib/store'
import { ocupados } from '@/lib/forecast'
import { SectionTitle, dec1 } from '../shared/ui'

const MIN = 6
const MAX = 240

/** Estadia média dos residentes (em meses) — a base da rotatividade estrutural da previsão. */
export function EstadiaForm({ lar }: { lar: Lar }) {
  const [valor, setValor] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const texto = valor ?? String(lar.estadiaMediaMeses)
  const n = Number(texto)
  const valido = /^\s*\d+\s*$/.test(texto) && n >= MIN && n <= MAX
  const residentes = ocupados(lar)
  const mudou = valor != null && texto.trim() !== String(lar.estadiaMediaMeses)

  const guardar = (e: FormEvent) => {
    e.preventDefault()
    if (!valido) {
      setErro(`Indique um número de meses entre ${MIN} e ${MAX}.`)
      return
    }
    atualizarLar(lar.id, { estadiaMediaMeses: n })
    setValor(null)
    setErro(null)
    toast.success('Estadia média guardada', 'A previsão já usa o novo valor.')
  }

  return (
    <section aria-labelledby="estadia-titulo">
      <SectionTitle
        id="estadia-titulo"
        title="Estadia média"
        text="Quanto tempo, em média, um residente fica na sua casa. Ajuda a prever a rotatividade, sobretudo quando o histórico é curto."
      />
      <form onSubmit={guardar} noValidate className="mt-6 flex flex-wrap items-end gap-3">
        <InputField
          label="Meses"
          inputMode="numeric"
          value={texto}
          onChange={(e) => {
            setValor(e.target.value)
            setErro(null)
          }}
          error={erro ?? undefined}
          wrapperClassName="w-40"
        />
        <Button type="submit" disabled={!mudou} className="min-h-13">
          Guardar
        </Button>
      </form>
      {valido && (
        <p className="mt-4 max-w-2xl text-ink-mute">
          Com {residentes} {residentes === 1 ? 'residente' : 'residentes'} e {n} meses de estadia média, a rotatividade esperada é de cerca de{' '}
          {dec1(residentes / Math.max(MIN, n))} saídas por mês. A previsão combina este valor com o seu histórico.
        </p>
      )}
    </section>
  )
}
