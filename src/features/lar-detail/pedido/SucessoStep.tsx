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
    { t: 'A equipa técnica recebe o pedido', d: `${lar.nome} já tem o perfil de ${nome} e a sua mensagem.` },
    {
      t: 'Responde-lhe em poucos dias úteis',
      d: 'Por aqui, por telefone ou por email. Recebe uma notificação no seu painel.',
    },
    c.visita
      ? { t: 'Confirma a visita', d: `Pediu visita para ${diaPorExtenso(c.visita.data)}, às ${c.visita.hora}. Se não der, propõem outra hora.` }
      : { t: 'Se não houver vaga imediata', d: 'Pode ficar na lista de espera. Vê a posição e a estimativa no seu painel.' },
  ]

  return (
    <div>
      <span aria-hidden className="flex size-14 animate-fade-up items-center justify-center rounded-full bg-leaf-500 text-white">
        <Check className="size-7" strokeWidth={2.5} />
      </span>
      <h3 ref={titulo} tabIndex={-1} className="mt-5 text-2xl font-semibold tracking-tight outline-none">
        Enviado a {lar.nome}
      </h3>
      <p className="mt-1 text-ink-mute">Guardámos uma cópia em “Os meus pedidos”.</p>

      <p className="mt-8 text-sm text-ink-mute">O que acontece agora</p>
      <ol className="mt-2 border-t border-line">
        {passos.map((p, i) => (
          <li key={p.t} className="flex gap-4 border-b border-line py-4">
            <span aria-hidden className="w-5 shrink-0 text-lg font-semibold text-ink-mute tabular">
              {i + 1}
            </span>
            <span>
              <span className="block font-medium text-ink">{p.t}</span>
              <span className="text-ink-mute">{p.d}</span>
            </span>
          </li>
        ))}
      </ol>
      {lar.telefone && (
        <p className="mt-5 text-ink-mute">
          Situação urgente, como uma alta hospitalar? Ligue:{' '}
          <a href={telHref(lar.telefone)} className="text-terra-600 tabular hover:underline">
            {lar.telefone}
          </a>
        </p>
      )}
    </div>
  )
}
