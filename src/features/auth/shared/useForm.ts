import { useCallback, useRef, useState, type ChangeEvent, type FormEvent } from 'react'

export type FormValues = Record<string, string | boolean>
export type Rules<V extends FormValues> = { [K in keyof V]?: (value: V[K], all: V) => string | undefined }
type Key<V> = keyof V & string

const reduzMovimento = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Estado de formulário com validação acessível.
 * Padrão "avisar tarde, aliviar cedo": um erro só aparece ao sair do campo (se foi alterado) ou ao submeter;
 * depois de aparecer, desaparece assim que o valor fica correto.
 */
export function useForm<V extends FormValues>({ initial, rules, order }: { initial: V; rules: Rules<V>; order: Key<V>[] }) {
  const [values, setValues] = useState<V>(initial)
  const [armed, setArmed] = useState<Partial<Record<Key<V>, boolean>>>({})
  const [external, setExternal] = useState<Partial<Record<Key<V>, string>>>({})
  const [attempts, setAttempts] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const refs = useRef(new Map<Key<V>, HTMLElement | null>())

  const computeErrors = useCallback(
    (vals: V, ext: Partial<Record<Key<V>, string>>) => {
      const out: Partial<Record<Key<V>, string>> = {}
      for (const k of order) {
        const msg = ext[k] ?? rules[k]?.(vals[k], vals)
        if (msg) out[k] = msg
      }
      return out
    },
    [order, rules],
  )

  const errors = computeErrors(values, external)
  const errorOf = (k: Key<V>) => (armed[k] ? errors[k] : undefined)

  const setValue = <K extends Key<V>>(k: K, v: V[K]) => {
    // se o campo ainda não mostra erro, só volta a avisar quando sair dele
    if (!(armed[k] && errors[k])) setArmed((a) => ({ ...a, [k]: false }))
    setValues((prev) => ({ ...prev, [k]: v }))
    if (external[k]) setExternal((e) => ({ ...e, [k]: undefined }))
  }

  const blur = (k: Key<V>) => {
    if (values[k] !== initial[k] || attempts > 0) setArmed((a) => ({ ...a, [k]: true }))
  }

  const refFor = (k: Key<V>) => (el: HTMLElement | null) => {
    refs.current.set(k, el)
  }

  const focusField = useCallback((k: Key<V>) => {
    const el = refs.current.get(k)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: reduzMovimento() ? 'auto' : 'smooth' })
    el.focus({ preventScroll: true })
  }, [])

  /** Props para InputField / SelectField / TextareaField / PasswordField. */
  const field = (k: Key<V>) => ({
    name: k,
    value: String(values[k] ?? ''),
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setValue(k, e.target.value as V[typeof k]),
    onBlur: () => blur(k),
    error: errorOf(k),
    ref: refFor(k),
  })

  /** Props para caixas de seleção (o erro é mostrado à parte). */
  const checkbox = (k: Key<V>) => ({
    name: k,
    checked: Boolean(values[k]),
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [k]: e.target.checked }))
      setArmed((a) => ({ ...a, [k]: true }))
    },
    ref: refFor(k),
    'aria-invalid': errorOf(k) ? true : undefined,
  })

  /** Erro vindo de fora (ex.: o registo devolveu "email já existe"). */
  const setFieldError = (k: Key<V>, msg: string) => {
    setExternal((e) => ({ ...e, [k]: msg }))
    setArmed((a) => ({ ...a, [k]: true }))
  }

  /** Lista para o resumo de erros, pela ordem do formulário. */
  const visibleErrors = order.flatMap((k) => {
    const msg = errorOf(k)
    return msg ? [{ key: k, message: msg }] : []
  })

  const handleSubmit = (onValid: (vals: V) => void | Promise<void>) => async (e: FormEvent) => {
    e.preventDefault()
    if (submittingRef.current) return
    setAttempts((n) => n + 1)
    setArmed(Object.fromEntries(order.map((k) => [k, true])) as Partial<Record<Key<V>, boolean>>)
    const errs = computeErrors(values, external)
    const first = order.find((k) => errs[k])
    if (first) {
      requestAnimationFrame(() => focusField(first))
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    try {
      await onValid(values)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return {
    values,
    setValue,
    field,
    checkbox,
    errorOf,
    visibleErrors,
    attempts,
    submitting,
    handleSubmit,
    focusField,
    setFieldError,
  }
}

/** Pequena pausa para o estado "a enviar" ser percetível (e simular a ida ao servidor). */
export const pausa = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
