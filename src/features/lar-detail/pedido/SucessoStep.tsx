import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { diaPorExtenso, telHref } from '../helpers'

/** Confirmação depois de enviar: o que acontece a seguir. */
export function SucessoStep({ lar, c }: { lar: Lar; c: Candidatura }) {
  const titulo = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titulo.current?.focus()
  }, [])
  const nome = c.perfil.nome.split(' ')[0]
  const passos = [
    {
      t: 'A equipa técnica recebe o pedido',
      d: `Neste momento, ${lar.nome} já tem o perfil de ${nome} e a sua mensagem.`,
    },
    {
      t: 'Responde-lhe por aqui, por telefone ou por email',
      d: lar.telefone
        ? `A resposta costuma chegar em poucos dias úteis. Se a situação for urgente — por exemplo, uma alta hospitalar —, ligue diretamente.`
        : 'A resposta costuma chegar em poucos dias úteis. Receberá uma notificação no seu painel.',
    },
    c.visita
      ? {
          t: 'Confirma a visita',
          d: `Pediu visita para ${diaPorExtenso(c.visita.data)}, às ${c.visita.hora}. A instituição confirma ou propõe outra hora.`,
        }
      : {
          t: 'Se não houver vaga imediata',
          d: 'Pode ser inscrito(a) na lista de espera. Acompanha a posição e a estimativa de espera no seu painel.',
        },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <span className="flex size-14 shrink-0 animate-fade-up items-center justify-center rounded-full bg-leaf-500 text-white shadow-soft">
          <Check aria-hidden className="size-8" strokeWidth={3} />
        </span>
        <div>
          <h3 ref={titulo} tabIndex={-1} className="text-2xl font-semibold outline-none">
            Pedido enviado a <em>{lar.nome}</em>
          </h3>
          <p className="mt-1 text-ink-soft">Guardámos uma cópia no seu painel, em “Os meus pedidos”.</p>
        </div>
      </div>
      <div>
        <p className="text-sm font-bold tracking-[0.12em] text-ink-mute uppercase">O que acontece agora</p>
        <ol className="mt-3 divide-y divide-line border-y border-line">
          {passos.map((p, i) => (
            <li key={p.t} className="flex gap-4 py-4">
              <span aria-hidden className="w-7 shrink-0 font-display text-3xl leading-none font-semibold text-terra-500 italic">
                {i + 1}
              </span>
              <span>
                <strong className="block text-ink">{p.t}</strong>
                <span className="text-ink-soft">{p.d}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      {lar.telefone && (
        <p className="text-ink-soft">
          Telefone da instituição:{' '}
          <a href={telHref(lar.telefone)} className="link tabular">
            {lar.telefone}
          </a>
        </p>
      )}
    </div>
  )
}
