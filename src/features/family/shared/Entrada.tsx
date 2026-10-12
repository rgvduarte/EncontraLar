import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { BadgeCheck, Check } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { confirmarEntradaFamilia, jaAvaliou, useMinhasCandidaturas } from '@/lib/store'
import { entradaVerificada } from '@/lib/negocio'
import { cn } from '@/lib/cn'
import type { PedidoComLar } from './data'
import { diaMes, emCurso, emLar, entradaPorConfirmar, familiaConfirmou, oLar } from './estado'
import { MoreLink } from './ui'
import { comArtigo, deNome, isoDia, telHref } from './text'

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * "Já entrou?": a família escolhe o dia da entrada (hoje por omissão) e confirma.
 * Fica montado enquanto fecha (guarda o último pedido), para a animação de saída não cortar.
 */
export function ConfirmarEntradaModal({ pedido, open, onClose }: { pedido: PedidoComLar | undefined; open: boolean; onClose: () => void }) {
  const ultimo = useRef(pedido)
  if (pedido) ultimo.current = pedido
  const p = pedido ?? ultimo.current
  const formId = useId()
  const hoje = isoDia(new Date())
  const [data, setData] = useState(hoje)
  const [erro, setErro] = useState<string | null>(null)
  const cands = useMinhasCandidaturas()

  useEffect(() => {
    if (!open) return
    setData(isoDia(new Date()))
    setErro(null)
  }, [open])

  if (!p) return null
  const { c, lar } = p
  const min = isoDia(new Date(c.criadaEm))
  const outros = cands.filter((x) => x.id !== c.id && x.perfilId === c.perfilId && emCurso(x)).length

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!data || data > hoje) return setErro('Escolha um dia até hoje.')
    if (data < min) return setErro(`Escolha um dia a partir de ${diaMes(min)}, quando fez o pedido.`)
    confirmarEntradaFamilia(c.id, data)
    onClose()
    toast.success('Entrada confirmada', `${maiuscula(oLar(lar.nome))} é avisada. Já pode deixar a sua avaliação.`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirmar entrada"
      description={lar.nome}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            Voltar
          </Button>
          <Button type="submit" form={formId}>
            Confirmar entrada
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate>
        <InputField
          type="date"
          label={`Em que dia ${comArtigo(c.perfil)} entrou?`}
          value={data}
          min={min}
          max={hoje}
          onChange={(e) => {
            setData(e.target.value)
            setErro(null)
          }}
          error={erro ?? undefined}
          wrapperClassName="sm:max-w-xs"
        />
        <p className="mt-5 text-ink-soft">
          A instituição é avisada. Com a sua confirmação e o registo da instituição, a entrada fica verificada.
        </p>
        {outros > 0 && (
          <p className="mt-3 text-ink-soft">
            {outros === 1 ? 'O outro pedido' : `Os outros ${outros} pedidos`} para {comArtigo(c.perfil)}{' '}
            {outros === 1 ? 'continua ativo' : 'continuam ativos'}. Se já não precisar, pode cancelá-los em “Pedidos”.
          </p>
        )}
      </form>
    </Modal>
  )
}

/** Estado de um pedido com entrada: "Entrou a 9 de outubro" e, com as duas confirmações, "Entrada verificada". */
export function EntradaEstado({ c }: { c: Candidatura }) {
  if (!c.entrada) return null
  const verificada = entradaVerificada(c)
  return (
    <div>
      <p className="flex items-center gap-2 text-lg font-semibold">
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-leaf-500" />
        Entrou a {diaMes(c.entrada.data)}
      </p>
      {verificada ? (
        <p className="mt-1 inline-flex items-center gap-1.5 font-medium text-terra-700">
          <BadgeCheck aria-hidden className="size-5" />
          Entrada verificada
        </p>
      ) : familiaConfirmou(c) ? (
        <p className="mt-1 text-ink-mute">Confirmada por si. Fica verificada quando a instituição também a registar.</p>
      ) : null}
    </div>
  )
}

/** O que este pedido pede à família à volta da entrada (ou null). */
export function passoEntrada(c: Candidatura): 'ja-entrou' | 'confirmar' | 'avaliar' | 'avaliado' | null {
  if (c.estado === 'aceite') return 'ja-entrou'
  if (entradaPorConfirmar(c)) return 'confirmar'
  if (c.estado === 'admitida' && familiaConfirmou(c)) return jaAvaliou(c) ? 'avaliado' : 'avaliar'
  return null
}

/**
 * Bloco calmo da entrada (painel e cartão do pedido), conforme o momento:
 * - vaga aceite → "Já entrou no …?" (abre a escolha do dia);
 * - a instituição registou a entrada → "… registou a entrada de … a …. Confirma?";
 * - entrada confirmada pela família → "Avaliar …" (ou "Já avaliou").
 */
export function EntradaTile({
  c,
  lar,
  variant = 'tile',
  onConfirmar,
  onAvaliar,
  onDispensar,
  className,
}: {
  c: Candidatura
  lar: Lar
  /** tile = no Resumo (h2, com ligação ao pedido); card = dentro do cartão do pedido (h3) */
  variant?: 'tile' | 'card'
  onConfirmar: () => void
  onAvaliar: () => void
  /** "Agora não" (só no Resumo) */
  onDispensar?: () => void
  className?: string
}) {
  const titleId = useId()
  const passo = passoEntrada(c)
  if (!passo) return null
  const tile = variant === 'tile'
  const H = tile ? 'h2' : 'h3'
  const caixa = cn(tile ? 'tile' : 'rounded-[1.75rem] bg-sand p-6 sm:p-8', className)
  const titulo = cn('font-semibold text-ink', tile ? 'mt-2 text-2xl leading-tight sm:text-3xl' : 'text-xl leading-snug sm:text-2xl')
  const verPedido = tile && (
    <MoreLink to={`/familia/pedidos#pedido-${c.id}`} className="sm:ml-2">
      Ver pedido
    </MoreLink>
  )

  if (passo === 'avaliado') {
    return (
      <p className={cn('flex items-start gap-2 text-ink-soft', className)}>
        <BadgeCheck aria-hidden className="mt-1 size-5 shrink-0 text-terra-700" />
        <span>
          <span className="font-semibold text-ink">Já avaliou.</span> A sua avaliação aparece na ficha como Avaliação verificada.
        </span>
      </p>
    )
  }

  if (passo === 'ja-entrou') {
    return (
      <section aria-labelledby={titleId} className={caixa}>
        {tile && <p className="eyebrow">Vaga aceite · {lar.localidade}</p>}
        <H id={titleId} className={titulo}>
          Já entrou {emLar(lar.nome)}?
        </H>
        <p className="mt-2 max-w-2xl text-ink-mute">
          Quando {comArtigo(c.perfil)} entrar, confirme aqui o dia. Depois pode deixar uma avaliação verificada.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <Button onClick={onConfirmar} className="w-full sm:w-auto">
            Confirmar entrada
          </Button>
          {verPedido}
        </div>
      </section>
    )
  }

  if (passo === 'confirmar') {
    const confirmar = () => {
      confirmarEntradaFamilia(c.id, c.entrada!.data)
      toast.success('Entrada verificada', 'Obrigado. Já pode deixar a sua avaliação.')
    }
    return (
      <section aria-labelledby={titleId} className={caixa}>
        {tile && <p className="eyebrow">Entrada registada pela instituição</p>}
        <H id={titleId} className={titulo}>
          {maiuscula(oLar(lar.nome))} registou a entrada {deNome(c.perfil)} a {diaMes(c.entrada!.data)}. Confirma?
        </H>
        <p className="mt-2 max-w-2xl text-ink-mute">Com a sua confirmação, a entrada fica verificada e pode avaliar a instituição.</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <Button onClick={confirmar} className="w-full sm:w-auto">
            Confirmar
          </Button>
          {lar.telefone && (
            <p className="text-center text-ink-mute sm:text-left">
              Não está certo?{' '}
              <a href={telHref(lar.telefone)} className="link inline-flex min-h-12 items-center">
                Ligar para a instituição
              </a>
            </p>
          )}
        </div>
      </section>
    )
  }

  // passo === 'avaliar'
  return (
    <section aria-labelledby={titleId} className={caixa}>
      <p className={cn('flex items-center gap-1.5 text-sm font-semibold', entradaVerificada(c) ? 'text-terra-700' : 'text-ink-mute')}>
        {entradaVerificada(c) ? <BadgeCheck aria-hidden className="size-4" /> : <Check aria-hidden className="size-4" />}
        {entradaVerificada(c) ? 'Entrada verificada' : 'Entrada confirmada'}
      </p>
      <H id={titleId} className={titulo}>
        Avaliar {lar.nome}
      </H>
      <p className="mt-2 max-w-2xl text-ink-mute">
        Conte a outras famílias como está a correr. Aparece na ficha como Avaliação verificada.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <Button onClick={onAvaliar} className="w-full sm:w-auto">
          Escrever avaliação
        </Button>
        {onDispensar && (
          <Button variant="ghost" onClick={onDispensar} className="w-full sm:w-auto">
            Agora não
          </Button>
        )}
      </div>
    </section>
  )
}
