import { createElement, useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useLenis } from '@/components/motion'

export type FormValues = Record<string, string | boolean>
export type Rules<V extends FormValues> = { [K in keyof V]?: (value: V[K], all: V) => string | undefined }
type Key<V> = keyof V & string

const reduzMovimento = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Mensagem de erro que entra com um deslize/fade subtil (sem "abanar"); a `key` faz com que
 * uma mensagem nova (ex.: "falta o email" → "email incompleto") volte a entrar.
 */
export function errorNode(msg: ReactNode, key: string): ReactNode {
  return createElement(
    'span',
    { key, className: 'block animate-[pop-in_.34s_cubic-bezier(.16,1,.3,1)_both] motion-reduce:animate-none' },
    msg,
  )
}

/**
 * Estado de formulário com validação acessível.
 * Padrão "avisar tarde, aliviar cedo": um erro só aparece ao sair do campo (se foi alterado) ou ao submeter;
 * depois de aparecer, desaparece assim que o valor fica correto.
 */
export function useForm<V extends FormValues>({
  initial,
  rules,
  order,
  reveal,
}: {
  initial: V
  rules: Rules<V>
  order: Key<V>[]
  /**
   * Antes de levar o foco a um campo: torna-o visível (ex.: abre o passo onde está) e
   * devolve quantos ms esperar pela animação (0 se já estava visível).
   */
  reveal?: (k: Key<V>) => number
}) {
  const [values, setValues] = useState<V>(initial)
  const [armed, setArmed] = useState<Partial<Record<Key<V>, boolean>>>({})
  const [external, setExternal] = useState<Partial<Record<Key<V>, string>>>({})
  const [attempts, setAttempts] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  // depois de um envio bem-sucedido (ex.: conta criada) as regras deixam de se aplicar:
  // "já existe uma conta com este email" passaria a ser verdade durante o visto verde
  const [frozen, setFrozen] = useState(false)
  const submittingRef = useRef(false)
  const refs = useRef(new Map<Key<V>, HTMLElement | null>())
  const lenis = useLenis()
  const lenisRef = useRef(lenis)
  const revealRef = useRef(reveal)
  useEffect(() => {
    lenisRef.current = lenis
    revealRef.current = reveal
  })

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
  const errorOf = (k: Key<V>) => (!frozen && armed[k] ? errors[k] : undefined)
  /** Erro já pronto a mostrar (animado), para passar a `error` dos campos. */
  const errorView = (k: Key<V>) => {
    const msg = errorOf(k)
    return msg ? errorNode(msg, msg) : undefined
  }

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
    const ir = () => {
      const el = refs.current.get(k)
      if (!el) return
      const l = lenisRef.current
      if (l && !reduzMovimento()) {
        // centrado no ecrã, com o cabeçalho fixo em conta
        const h = el.getBoundingClientRect().height
        l.scrollTo(el, { offset: -Math.max(112, (window.innerHeight - h) / 2.6), duration: 0.9 })
      } else el.scrollIntoView({ block: 'center', behavior: reduzMovimento() ? 'auto' : 'smooth' })
      el.focus({ preventScroll: true })
    }
    const espera = revealRef.current?.(k) ?? 0
    if (espera > 0) window.setTimeout(ir, espera)
    else ir()
  }, [])

  /**
   * Valida só estes campos (ex.: um passo): mostra os erros deles e devolve o primeiro a corrigir,
   * ou null se estão todos certos.
   */
  const validate = (keys: Key<V>[]): Key<V> | null => {
    setArmed((a) => ({ ...a, ...Object.fromEntries(keys.map((k) => [k, true])) }))
    return keys.find((k) => errors[k]) ?? null
  }

  /** true se estes campos já estão todos certos (sem mostrar erros). */
  const isValid = (keys: Key<V>[]) => keys.every((k) => !errors[k])

  /** Props para InputField / SelectField / TextareaField / PasswordField. */
  const field = (k: Key<V>) => ({
    name: k,
    value: String(values[k] ?? ''),
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setValue(k, e.target.value as V[typeof k]),
    onBlur: () => blur(k),
    error: errorView(k),
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
    errorView,
    /** congela o formulário (sem erros) — chamar quando o envio teve sucesso, antes de mudar de página */
    freeze: () => setFrozen(true),
    validate,
    isValid,
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
