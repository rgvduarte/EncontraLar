import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { CircleCheck, Star } from 'lucide-react'
import type { Candidatura, Lar, Review } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { TextareaField } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { avaliarLar, useCurrentUser } from '@/lib/store'
import { cn } from '@/lib/cn'

type Aspeto = keyof Review['aspetos']

const ASPETOS: { k: Aspeto; label: string }[] = [
  { k: 'cuidados', label: 'Cuidados' },
  { k: 'alimentacao', label: 'Alimentação' },
  { k: 'instalacoes', label: 'Instalações' },
  { k: 'comunicacao', label: 'Comunicação' },
]

const PALAVRA = ['', 'Mau', 'Fraco', 'Razoável', 'Bom', 'Excelente'] as const
const MIN_TEXTO = 15

/**
 * Classificação de 1 a 5 estrelas que se pode escolher: um grupo de rádios nativos (Tab entra no
 * grupo, as setas mudam a nota), cada estrela é um alvo de 44px e a nota escolhida diz-se também
 * por extenso ("4 · Bom"), não só pela cor.
 */
export function StarRating({
  label,
  value,
  onChange,
  size = 'md',
  error,
  erroPartilhado,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  size?: 'md' | 'lg'
  /** mensagem de erro própria, por baixo das estrelas */
  error?: string
  /** id de uma mensagem de erro comum a vários grupos (ex.: "Avalie os quatro aspetos.") */
  erroPartilhado?: string
}) {
  const id = useId()
  const [hover, setHover] = useState(0)
  const mostra = hover || value
  const lg = size === 'lg'
  const invalido = Boolean(error || erroPartilhado)
  return (
    <div
      role="radiogroup"
      aria-labelledby={`${id}-l`}
      aria-describedby={error ? `${id}-e` : erroPartilhado}
      aria-required
      aria-invalid={invalido || undefined}
      data-invalido={invalido ? '' : undefined}
      className={cn('grid items-center gap-x-3', lg ? 'grid-cols-[auto_minmax(0,1fr)] gap-y-2' : 'grid-cols-[auto_minmax(0,1fr)] gap-y-0.5 sm:grid-cols-[8.5rem_auto_minmax(0,1fr)]')}
    >
      <span id={`${id}-l`} className={cn('col-span-2 font-medium', invalido ? 'text-alert-700' : 'text-ink', lg ? 'text-lg' : 'sm:col-span-1')}>
        {label}
      </span>
      <div className="-ml-1.5 flex" onPointerLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(n)}
            className={cn(
              'group relative flex cursor-pointer items-center justify-center rounded-full',
              'has-[:focus-visible]:outline-3 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-terra-500',
              lg ? 'size-12' : 'size-11',
            )}
          >
            <input
              type="radio"
              name={id}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              aria-label={`${n} de 5 — ${PALAVRA[n]}`}
              className="sr-only"
            />
            <Star
              aria-hidden
              strokeWidth={1.5}
              className={cn(
                'transition-[color,fill,scale] duration-200 ease-[cubic-bezier(.16,1,.3,1)] group-active:scale-90',
                lg ? 'size-9' : 'size-7',
                // estrela vazia com contorno pine-400 (≥ 3:1); cheia a laranja, como nas fichas
                n <= mostra ? 'fill-sun-500 text-sun-500' : 'fill-transparent text-pine-400',
              )}
            />
          </label>
        ))}
      </div>
      <span aria-hidden className={cn('text-sm tabular', mostra ? 'text-ink-soft' : 'text-ink-mute')}>
        {mostra ? `${mostra} · ${PALAVRA[mostra]}` : 'Por escolher'}
      </span>
      {error && (
        <p id={`${id}-e`} className="col-span-full text-sm font-medium text-alert-700">
          {error}
        </p>
      )}
    </div>
  )
}

/** "Ana F." — como o nome aparece na ficha (a mesma regra do store). */
function autorPublico(nome: string): string {
  const [primeiro, ...resto] = nome.trim().split(/\s+/)
  return resto.length ? `${primeiro} ${resto[resto.length - 1]![0]}.` : (primeiro ?? 'Família')
}

const VAZIO: Record<Aspeto, number> = { cuidados: 0, alimentacao: 0, instalacoes: 0, comunicacao: 0 }

/**
 * Avaliação verificada (só depois de a família confirmar a entrada): nota geral, quatro aspetos e
 * um texto curto. Depois de publicar, o diálogo agradece e mostra o caminho para a ficha.
 */
export function AvaliarModal({ c, lar, open, onClose }: { c: Candidatura; lar: Lar; open: boolean; onClose: () => void }) {
  const user = useCurrentUser()
  const formId = useId()
  const form = useRef<HTMLFormElement>(null)
  const [nota, setNota] = useState(0)
  const [aspetos, setAspetos] = useState(VAZIO)
  const [texto, setTexto] = useState('')
  const [tentou, setTentou] = useState(false)
  const [feito, setFeito] = useState(false)

  // cada abertura começa do zero (exceto se já publicou: mantém o agradecimento até fechar)
  useEffect(() => {
    if (!open || feito) return
    setNota(0)
    setAspetos(VAZIO)
    setTexto('')
    setTentou(false)
    // só ao abrir
  }, [open])

  const erroAspetosId = `${formId}-aspetos`
  const faltaAspeto = tentou && ASPETOS.some((a) => !aspetos[a.k])
  const erroTexto = tentou && texto.trim().length < MIN_TEXTO ? 'Escreva pelo menos uma frase.' : undefined

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const valido = nota > 0 && ASPETOS.every((a) => aspetos[a.k] > 0) && texto.trim().length >= MIN_TEXTO
    if (!valido) {
      setTentou(true)
      // o foco vai para o primeiro campo por preencher (o erro é lido com ele)
      requestAnimationFrame(() => {
        const alvo = form.current?.querySelector<HTMLElement>('[data-invalido] input, textarea[aria-invalid="true"]')
        alvo?.focus()
      })
      return
    }
    const r = avaliarLar(c.id, { nota, texto, aspetos })
    if (!r) {
      toast.error('Não foi possível publicar a avaliação', 'Confirme a entrada primeiro. Cada pedido só pode ser avaliado uma vez.')
      return
    }
    setFeito(true)
  }

  const fechar = () => {
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={fechar}
      onClosed={() => setFeito(false)}
      size="lg"
      title={feito ? 'Avaliação publicada' : `Avaliar ${lar.nome}`}
      description={feito ? lar.nome : 'Avaliação verificada: só quem confirmou a entrada pode avaliar.'}
      footer={
        feito ? (
          <>
            <ButtonLink to={`/lar/${lar.id}`} variant="subtle">
              Ver na ficha
            </ButtonLink>
            <Button onClick={fechar}>Fechar</Button>
          </>
        ) : (
          <>
            <Button variant="subtle" onClick={fechar}>
              Agora não
            </Button>
            <Button type="submit" form={formId}>
              Publicar avaliação
            </Button>
          </>
        )
      }
    >
      {feito ? (
        <div role="status" className="flex items-start gap-4 py-2 motion-safe:animate-[fade-up_.5s_cubic-bezier(.16,1,.3,1)_both]">
          <CircleCheck aria-hidden className="mt-0.5 size-7 shrink-0 text-leaf-600" />
          <p className="text-lg text-ink">Obrigado. A sua avaliação aparece na ficha como Avaliação verificada.</p>
        </div>
      ) : (
        <form id={formId} ref={form} onSubmit={submit} noValidate className="flex flex-col gap-8">
          <StarRating label="Nota geral" size="lg" value={nota} onChange={setNota} error={tentou && !nota ? 'Escolha de 1 a 5 estrelas.' : undefined} />
          <div className="flex flex-col gap-4 border-t border-line pt-6 sm:gap-2">
            {ASPETOS.map((a) => (
              <StarRating
                key={a.k}
                label={a.label}
                value={aspetos[a.k]}
                onChange={(n) => setAspetos((s) => ({ ...s, [a.k]: n }))}
                erroPartilhado={tentou && !aspetos[a.k] ? erroAspetosId : undefined}
              />
            ))}
            {faltaAspeto && (
              <p id={erroAspetosId} className="text-sm font-medium text-alert-700">
                Avalie os quatro aspetos, de 1 a 5 estrelas.
              </p>
            )}
          </div>
          <TextareaField
            label="A sua opinião"
            hint="O que correu bem e o que podia melhorar. Sem nomes de funcionários nem dados de saúde."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={1000}
            rows={4}
            error={erroTexto}
          />
          {user && (
            <p className="-mt-3 text-sm text-ink-mute">
              Aparece na ficha como “{autorPublico(user.nome)}”, com a indicação Avaliação verificada.
            </p>
          )}
        </form>
      )}
    </Modal>
  )
}
