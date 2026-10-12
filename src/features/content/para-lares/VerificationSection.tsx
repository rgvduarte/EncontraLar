/**
 * "Como funciona a verificação" — linha do tempo em 4 passos, sobre verde-pinho, com o selo.
 */
import { useMemo } from 'react'
import { ClipboardList, FileCheck2, Footprints, Stamp } from 'lucide-react'
import { useLares } from '@/lib/store'
import { SeloVerificado } from '@/components/brand/SeloVerificado'
import { AzulejoBand, CalcadaDivider, calcadaStonesBg } from '@/components/brand/patterns'
import { num } from '@/lib/format'

const PASSOS = [
  {
    Icon: ClipboardList,
    titulo: 'Pedido',
    texto:
      'Regista a instituição e indica o número da licença de funcionamento. A ficha pode ser preenchida logo e aparece como «verificação em curso».',
  },
  {
    Icon: FileCheck2,
    titulo: 'Validação da licença',
    texto:
      'Confirmamos que a licença foi emitida pelo Instituto da Segurança Social e que corresponde à resposta social e à capacidade que indicou.',
  },
  {
    Icon: Footprints,
    titulo: 'Visita presencial',
    texto:
      'Alguém da equipa visita a casa, em data combinada consigo: quartos, espaços comuns, preços afixados e a equipa de serviço.',
  },
  {
    Icon: Stamp,
    titulo: 'Selo na ficha',
    texto:
      'O selo aparece na ficha e nos resultados, com a data da visita. É renovado todos os anos e retirado se a informação deixar de corresponder à realidade.',
  },
] as const

export function VerificationSection() {
  const lares = useLares()
  const { verificadas, total } = useMemo(
    () => ({ verificadas: lares.filter((l) => l.verificacao.estado === 'verificado').length, total: lares.length }),
    [lares],
  )

  return (
    <section aria-labelledby="pl-verificacao" className="on-dark relative bg-pine-900 text-pine-50">
      <CalcadaDivider color="#163a37" bg="#fbf8f3" height={26} className="absolute inset-x-0 -top-[25px]" />
      <div className="absolute inset-0" style={calcadaStonesBg('#ffffff', 0.035)} aria-hidden />
      <div className="relative container-page py-20 sm:py-28">
        <div className="grid items-end gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <p className="text-xs font-bold tracking-[0.12em] text-sun-200 uppercase">Como funciona a verificação</p>
            <h2 id="pl-verificacao" className="mt-3 text-4xl font-semibold text-white sm:text-5xl">
              A confiança das famílias <em>não se compra</em>. Verifica-se.
            </h2>
            <p className="mt-5 max-w-[60ch] text-lg text-pine-100">
              O selo não depende do plano que escolhe. Todas as instituições passam pelos mesmos quatro passos — e as famílias veem a data da
              última visita.
            </p>
          </div>
          <div className="flex items-center gap-5 lg:col-span-4 lg:justify-end">
            <SeloVerificado tone="light" size={132} />
            <p className="max-w-48 text-sm text-pine-200">
              <strong className="font-display block text-3xl text-white tabular">
                {num(verificadas)} <span className="text-lg font-normal text-pine-300">de {num(total)}</span>
              </strong>
              instituições do mapa de demonstração já têm selo.
            </p>
          </div>
        </div>

        <ol className="relative mt-16 grid gap-10 md:grid-cols-4 md:gap-6">
          {/* linha que une os passos */}
          <span aria-hidden className="absolute top-7 bottom-7 left-7 w-0.5 bg-pine-600 md:top-7 md:right-[24%] md:bottom-auto md:h-0.5 md:w-auto" />
          {PASSOS.map((p, i) => (
            <li key={p.titulo} className="relative flex gap-5 md:flex-col md:gap-6 md:pr-4">
              <span className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl bg-pine-950 ring-2 ring-pine-500">
                <p.Icon aria-hidden className="size-6 text-sun-200" />
              </span>
              <div>
                <p className="text-xs font-bold tracking-[0.12em] text-sun-200 uppercase">Passo {i + 1}</p>
                <h3 className="mt-1 text-2xl font-semibold text-white">{p.titulo}</h3>
                <p className="mt-2 text-base text-pine-100">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-14 border-t border-white/10 pt-6 text-sm text-pine-300">
          Neste protótipo, as instituições e os selos são fictícios: o processo descrito é o que seguiremos na versão em produção.
        </p>
      </div>
      <AzulejoBand color="#4f9b8c" opacity={0.5} size={40} className="h-10 opacity-40" />
    </section>
  )
}
