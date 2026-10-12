import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import type { Lar } from '@/types'
import { LUGARES } from '@/data/localidades'
import { cn } from '@/lib/cn'
import { exemploCompatibilidade, lugarPorNome, pertoDe, type PrevisaoDestaque } from './homeData'
import { PreviewAlerta, PreviewCompatibilidade, PreviewPesquisa, Tray, descricaoPerfilExemplo } from './HowPreviews'

interface Passo {
  n: string
  titulo: ReactNode
  texto: ReactNode
  link: { to: string; label: string }
  preview: ReactNode
}

/** "Como funciona" — sequência numerada editorial, cada passo com uma pré-visualização real. */
export function HowItWorks({ lares, previsao }: { lares: Lar[]; previsao: PrevisaoDestaque | null }) {
  const lugar = useMemo(() => lugarPorNome('Porto') ?? LUGARES[0]!, [])
  const resultados = useMemo(() => pertoDe(lares, lugar, 3), [lares, lugar])
  const compat = useMemo(() => exemploCompatibilidade(lares, lugar), [lares, lugar])
  const larAlerta = previsao?.lar ?? resultados[0]?.lar

  const passos: Passo[] = [
    {
      n: '01',
      titulo: 'Procure no mapa',
      texto: (
        <>
          Escreva a localidade ou use a sua localização. Vê logo quem tem lugar livre, a que distância fica e quanto custa — sem ter de
          telefonar a ninguém.
        </>
      ),
      link: { to: '/pesquisa', label: 'Abrir o mapa de vagas' },
      preview:
        resultados.length > 0 ? (
          <Tray caption={`Resultados reais para «${lugar.label}», com as vagas indicadas hoje pelas instituições.`}>
            <PreviewPesquisa lugar={lugar} resultados={resultados} />
          </Tray>
        ) : null,
    },
    {
      n: '02',
      titulo: 'Compare com transparência',
      texto: (
        <>
          Diga-nos do que a pessoa precisa — demência, enfermagem 24 horas, orçamento — e mostramos a compatibilidade de cada lar
          com as razões à vista, incluindo o que <strong className="text-ink">não</strong> cumpre.
        </>
      ),
      link: { to: '/encontrar', label: 'Responder às 6 perguntas' },
      preview: compat ? (
        <Tray caption={descricaoPerfilExemplo(lugar)}>
          <PreviewCompatibilidade lar={compat.lar} match={compat.match} />
        </Tray>
      ) : null,
    },
    {
      n: '03',
      titulo: 'Peça vaga e receba alertas',
      texto: (
        <>
          Envie pedidos de vaga aos lares que escolher, acompanhe cada um no seu painel e receba um aviso assim que abrir uma vaga onde
          está inscrito(a) — ou num lar que decidiu seguir.
        </>
      ),
      link: { to: '/registar', label: 'Criar conta gratuita' },
      preview: larAlerta ? (
        <Tray caption="Exemplo de aviso e do percurso de um pedido, como aparecem no painel da família.">
          <PreviewAlerta lar={larAlerta} />
        </Tray>
      ) : null,
    },
  ]

  return (
    <section aria-labelledby="como-funciona-titulo" className="py-16 lg:py-24">
      <div className="container-page">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="eyebrow">Como funciona</p>
            <h2 id="como-funciona-titulo" className="mt-4 text-4xl leading-[1.08] font-semibold sm:text-5xl">
              Três passos, <em>sem</em> telefonemas às cegas.
            </h2>
          </div>
          <p className="self-end text-lg text-ink-soft lg:col-span-4 lg:col-start-9">
            O que vê abaixo não são imagens: são partes da aplicação, com os dados que estão hoje na plataforma.
          </p>
        </div>

        <ol className="mt-12 flex flex-col">
          {passos.map((p, i) => (
            <li key={p.n} className="relative grid grid-cols-1 gap-8 border-t border-line-strong py-10 lg:grid-cols-12 lg:gap-12 lg:py-14">
              <div className={cn('flex flex-col gap-3 sm:flex-row sm:gap-6 lg:col-span-5 lg:flex-col lg:gap-4', i % 2 === 1 && 'lg:order-2 lg:col-start-8')}>
                <span
                  aria-hidden
                  className="font-display text-6xl leading-none font-semibold text-terra-600 italic tabular sm:text-7xl lg:text-8xl"
                >
                  {p.n}
                </span>
                <div className="flex flex-col gap-3">
                  <h3 className="text-2xl font-semibold sm:text-3xl">
                    <span className="sr-only">Passo {i + 1}: </span>
                    {p.titulo}
                  </h3>
                  <p className="max-w-md text-lg text-ink-soft">{p.texto}</p>
                  <Link to={p.link.to} className="link group mt-1 inline-flex min-h-12 items-center gap-2 self-start">
                    {p.link.label}
                    <ArrowRight aria-hidden className="size-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
              <div className={cn('lg:col-span-7', i % 2 === 1 && 'lg:order-1 lg:col-start-1')}>{p.preview}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
