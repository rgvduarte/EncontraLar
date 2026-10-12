import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { AzulejoBand } from '@/components/brand/patterns'

const CAPITULOS = [
  {
    n: 'I',
    to: '/guia#visita',
    titulo: 'O que perguntar na visita',
    texto: 'Uma lista para levar no telemóvel: o que observar, o que perguntar à direção técnica, quem está de serviço à noite.',
  },
  {
    n: 'II',
    to: '/guia#apoios',
    titulo: 'Custos e apoios',
    texto: 'Como funciona a comparticipação da Segurança Social nas vagas com acordo e que outros apoios pode pedir.',
  },
  {
    n: 'III',
    to: '/guia#tipos',
    titulo: 'Lar, residência ou centro de dia?',
    texto: 'As diferenças explicadas sem siglas, para perceber qual responde melhor ao que a pessoa precisa hoje.',
  },
]

/** Faixa de apoio: o guia apresentado como capítulos de um pequeno livro. */
export function EmpathyBand() {
  return (
    <section aria-labelledby="apoio-titulo" className="relative bg-terra-50">
      <AzulejoBand color="#b9472f" opacity={0.45} size={36} className="h-9 border-y border-terra-200" />
      <div className="container-page grid grid-cols-1 gap-12 py-16 lg:grid-cols-12 lg:gap-16 lg:py-20">
        <div className="lg:col-span-5">
          <p className="text-xs font-bold tracking-[0.14em] text-terra-700 uppercase">Guia e apoios</p>
          <h2 id="apoio-titulo" className="mt-4 text-4xl leading-[1.08] font-semibold sm:text-5xl">
            Não está <em>sozinho(a)</em> nesta decisão.
          </h2>
          <p className="mt-6 text-lg text-ink-soft">
            Quase sempre acontece de repente: uma queda, um internamento, uma alta hospitalar marcada para a semana seguinte. Reunimos
            o que gostaríamos que alguém nos tivesse explicado nessa altura.
          </p>
        </div>
        <ol className="flex flex-col lg:col-span-7">
          {CAPITULOS.map((c) => (
            <li key={c.to} className="border-b border-terra-200 first:border-t">
              <Link to={c.to} className="group grid min-h-24 grid-cols-[3.25rem_1fr_auto] items-start gap-4 py-6 sm:grid-cols-[4.5rem_1fr_auto]">
                <span aria-hidden className="font-display text-3xl leading-none font-medium text-terra-600 italic sm:text-4xl">
                  {c.n}
                </span>
                <span>
                  <span className="block font-display text-2xl leading-snug font-semibold text-ink group-hover:underline group-hover:decoration-terra-400 group-hover:underline-offset-4">
                    {c.titulo}
                  </span>
                  <span className="mt-1 block text-ink-soft">{c.texto}</span>
                </span>
                <span className="mt-1 flex size-12 items-center justify-center rounded-full border-2 border-terra-300 text-terra-700 transition-colors group-hover:border-terra-600 group-hover:bg-terra-600 group-hover:text-white">
                  <ArrowRight aria-hidden className="size-5" />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
