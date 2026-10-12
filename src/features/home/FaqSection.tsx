import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Plus } from 'lucide-react'

const PERGUNTAS: { q: string; a: ReactNode }[] = [
  {
    q: 'É gratuito para as famílias?',
    a: (
      <>
        Sim. Pesquisar, comparar, guardar instituições, receber alertas de vaga e enviar pedidos não tem qualquer custo para as
        famílias. Quem adere ao serviço são as instituições, para gerir vagas e pedidos.
      </>
    ),
  },
  {
    q: 'Como sabem que a vaga é real?',
    a: (
      <>
        As vagas são indicadas pela própria instituição, no painel de gestão, e cada ficha mostra quando foram confirmadas pela
        última vez. As fichas com selo <strong>Verificado</strong> foram visitadas pela nossa equipa, que confirmou a licença e as
        instalações. Se a última atualização já tiver alguns dias, telefone antes de se deslocar.
      </>
    ),
  },
  {
    q: 'A previsão de vaga é garantida?',
    a: (
      <>
        Não. É uma estimativa estatística — como a previsão do tempo. Usa a rotatividade dos últimos 12 meses, a lista de espera
        efetiva e a época do ano, e mostra sempre um intervalo. Serve para planear com mais calma, não para substituir a conversa com
        a instituição.{' '}
        <Link to="/sobre#previsao" className="link">
          Veja como calculamos
        </Link>
        .
      </>
    ),
  },
  {
    q: 'Porque é que as IPSS e as Misericórdias têm preços diferentes?',
    a: (
      <>
        Nas vagas com acordo de cooperação com a Segurança Social, a mensalidade é calculada em função dos rendimentos da pessoa e do
        agregado familiar, por isso mostramos um intervalo. Nos lares privados o preço é fixo por tipo de quarto.{' '}
        <Link to="/guia#apoios" className="link">
          Saiba mais sobre comparticipações e apoios
        </Link>
        .
      </>
    ),
  },
  {
    q: 'O que acontece aos dados de saúde?',
    a: (
      <>
        O grau de dependência e os cuidados de que a pessoa precisa são dados sensíveis, protegidos pelo RGPD. Só são enviados a uma
        instituição quando decide pedir vaga nessa instituição, e pode apagar o perfil a qualquer momento no seu painel. Neste
        protótipo ficam guardados apenas no seu navegador.{' '}
        <Link to="/privacidade" className="link">
          Ler a política de privacidade
        </Link>
        .
      </>
    ),
  },
]

export function FaqSection() {
  return (
    <section aria-labelledby="faq-titulo" className="py-16 lg:py-24">
      <div className="container-page grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <p className="eyebrow">Perguntas frequentes</p>
            <h2 id="faq-titulo" className="mt-4 text-4xl leading-[1.08] font-semibold sm:text-5xl">
              O que nos <em>perguntam</em> mais.
            </h2>
            <p className="mt-5 text-lg text-ink-soft">
              Não encontra a sua dúvida?{' '}
              <Link to="/guia#faq" className="link">
                Veja todas as perguntas no guia
              </Link>
              .
            </p>
          </div>
        </div>
        <div className="border-t-2 border-ink lg:col-span-7">
          {PERGUNTAS.map((p, i) => (
            <details key={p.q} open={i === 0} className="group border-b border-line-strong">
              <summary className="flex min-h-18 cursor-pointer list-none items-center justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden">
                <span className="font-display text-xl leading-snug font-semibold text-ink group-hover:text-pine-800 sm:text-2xl">{p.q}</span>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-line-strong text-pine-800 transition-transform group-open:rotate-45 group-open:border-pine-700 group-open:bg-pine-700 group-open:text-white">
                  <Plus aria-hidden className="size-5" />
                </span>
              </summary>
              <div className="max-w-3xl pr-4 pb-7 text-lg text-ink-soft sm:pr-16">{p.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
