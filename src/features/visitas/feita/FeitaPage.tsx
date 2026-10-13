import { useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { BadgeCheck, BedDouble, CalendarClock, Check, CircleX, Copy, Euro, Handshake, KeyRound, ShieldCheck, Stethoscope } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLar, useVisitas } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { horaPt } from '@/lib/format'
import { Button, ButtonLink } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { VistoAnimado } from '@/features/lar-dashboard/shared/motion'
import { resumirMudancas, type Mudanca } from '../formulario'
import { esquecerEntrega, lerEntrega } from '../entrega'
import { ultimaLista } from '../lista/params'

const ICONE: Record<Mudanca['id'], LucideIcon> = {
  selo: BadgeCheck,
  licenca: ShieldCheck,
  vagas: BedDouble,
  precos: Euro,
  cuidados: Stethoscope,
  resultado: Handshake,
}

function iconeDe(m: Mudanca): LucideIcon {
  if (m.id !== 'resultado') return ICONE[m.id]
  if (m.titulo.startsWith('Recusou')) return CircleX
  if (m.titulo.startsWith('Aderiu')) return Handshake
  return CalendarClock
}

/** A palavra-passe provisória, uma vez, com "Copiar" (e seleção completa num toque, se a cópia falhar). */
function ContaCriada({ conta }: { conta: { email: string; palavraPasse: string } }) {
  const [copiada, setCopiada] = useState(false)
  const senha = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!copiada) return
    const t = window.setTimeout(() => setCopiada(false), 2500)
    return () => window.clearTimeout(t)
  }, [copiada])

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(conta.palavraPasse)
      setCopiada(true)
      toast.success('Palavra-passe copiada')
    } catch {
      // sem acesso à área de transferência: seleciona o texto para copiar à mão
      const el = senha.current
      const sel = window.getSelection()
      if (el && sel) {
        const r = document.createRange()
        r.selectNodeContents(el)
        sel.removeAllRanges()
        sel.addRange(r)
      }
      toast.info('Não foi possível copiar', 'A palavra-passe ficou selecionada: copie-a com o menu do telemóvel.')
    }
  }

  return (
    <section aria-labelledby="conta-titulo" className="rounded-[1.75rem] bg-sand p-6 sm:p-8">
      <h2 id="conta-titulo" className="flex items-center gap-2.5 text-2xl font-semibold">
        <KeyRound aria-hidden className="size-6 shrink-0 text-ink-mute" />
        Conta do responsável
      </h2>
      <dl className="mt-6 flex flex-col gap-5">
        <div>
          <dt className="text-sm text-ink-mute">Email</dt>
          <dd className="mt-0.5 text-lg font-medium break-all">{conta.email}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-mute">Palavra-passe provisória</dt>
          <dd className="mt-2 flex flex-wrap items-center gap-3">
            <span ref={senha} data-palavra-passe className="rounded-2xl bg-white px-5 py-2.5 text-[1.75rem] leading-tight font-semibold tracking-wide text-ink tabular select-all">
              {conta.palavraPasse}
            </span>
            <Button variant="secondary" onClick={() => void copiar()} icon={copiada ? <Check aria-hidden /> : <Copy aria-hidden />}>
              {copiada ? 'Copiada' : 'Copiar'}
            </Button>
          </dd>
        </div>
      </dl>
      <p className="mt-6 text-ink-soft">
        Entregue esta palavra-passe ao responsável. No protótipo é mostrada só agora; na versão real o responsável recebe um email para definir a sua.
      </p>
    </section>
  )
}

/**
 * /visitas/:larId/feita — o que a visita mudou na ficha (selo, vagas, preços, modalidade), a conta criada com a
 * palavra-passe provisória (uma vez) e o caminho para a próxima visita.
 */
export default function FeitaPage() {
  useDocumentTitle('Visita registada')
  const { larId } = useParams()
  const lar = useLar(larId)
  const ultima = useVisitas().find((v) => v.larId === larId)
  // lida uma vez, ao entrar: ao sair deste ecrã, a palavra-passe é esquecida
  const [entrega] = useState(() => lerEntrega(larId))
  useEffect(
    () => () => {
      if (entrega) esquecerEntrega(entrega.visitaId)
    },
    [entrega],
  )

  if (!lar) return <Navigate to="/visitas" replace />
  if (!ultima) return <Navigate to={`/visitas/${encodeURIComponent(lar.id)}`} replace />

  const daqui = entrega?.visitaId === ultima.id ? entrega : null
  const mudancas = daqui?.mudancas ?? resumirMudancas(undefined, lar, ultima)
  const conta = daqui?.conta

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <div className="flex items-center gap-4">
        <VistoAnimado className="size-14" />
        <p className="text-lg leading-snug text-ink-soft">
          Guardada às {horaPt(new Date(ultima.data).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }))}. A ficha já mostra as alterações.
        </p>
      </div>

      <section aria-labelledby="mudou-titulo">
        <h2 id="mudou-titulo" className="text-2xl font-semibold">
          O que mudou
        </h2>
        <ul className="mt-4 divide-y divide-line">
          {mudancas.map((m) => {
            const Icon = iconeDe(m)
            return (
              <li key={m.id} className="flex gap-4 py-4">
                <Icon aria-hidden className={m.id === 'selo' ? 'mt-0.5 size-6 shrink-0 text-terra-600' : 'mt-0.5 size-6 shrink-0 text-ink-mute'} />
                <div className="min-w-0">
                  <p className="font-semibold">{m.titulo}</p>
                  {m.detalhe && <p className="mt-0.5 leading-snug text-ink-mute">{m.detalhe}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {conta ? (
        <ContaCriada conta={conta} />
      ) : (
        ultima.contaCriadaId && (
          <p className="rounded-[1.5rem] bg-sand p-5 text-ink-soft">
            A conta do responsável foi criada. A palavra-passe provisória só é mostrada uma vez, logo a seguir a guardar.
          </p>
        )
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink to={ultimaLista()} size="lg" className="w-full sm:w-auto">
          Próxima visita
        </ButtonLink>
        <ButtonLink to={`/lar/${encodeURIComponent(lar.id)}`} variant="subtle" size="lg" className="w-full sm:w-auto">
          Ver ficha pública
        </ButtonLink>
      </div>
    </div>
  )
}
