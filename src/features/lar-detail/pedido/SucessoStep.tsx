import { useEffect, useRef } from 'react'
import type { Candidatura, Lar } from '@/types'
import { diaPorExtenso, telHref } from '../helpers'
import { Cascata } from '../motion'

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
      {/* círculo que salta e visto que se desenha */}
      <span aria-hidden className="ficha-sucesso-circulo flex size-14 items-center justify-center rounded-full bg-leaf-500 text-white">
        <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path className="ficha-sucesso-visto" pathLength={1} d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <h3 ref={titulo} tabIndex={-1} className="mt-5 text-2xl font-semibold tracking-tight outline-none">
        Enviado a {lar.nome}
      </h3>
      <p className="mt-1 text-ink-mute">Guardámos uma cópia em “Os meus pedidos”.</p>

      <p className="mt-8 text-sm text-ink-mute">O que acontece agora</p>
      <Cascata as="ol" passo={110} className="mt-2 border-t border-line">
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
      </Cascata>
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
