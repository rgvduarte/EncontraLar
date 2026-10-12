import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { Lar } from '@/types'
import { SeloVerificado } from '@/components/brand/SeloVerificado'
import { dataLonga, tempoRelativo } from '@/lib/format'
import { NATUREZA_LABEL } from '@/lib/labels'
import { Linha, Secao } from '../Secao'

const mesAnoLongo = (iso: string) => new Date(iso).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })

export function TransparenciaSection({ lar }: { lar: Lar }) {
  const v = lar.verificacao
  const verificado = v.estado === 'verificado'
  const revVerificadas = lar.reviews.filter((r) => r.verificada).length

  return (
    <Secao id="ficha-transparencia" rotulo="Transparência" titulo="O que verificámos, e quando">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        {verificado && <SeloVerificado ano={v.data ? new Date(v.data).getFullYear() : undefined} size={88} />}
        <div className="max-w-xl">
          <p className="text-2xl font-semibold tracking-tight text-ink">
            {verificado
              ? `Verificada pelo EncontraLar${v.data ? ` em ${mesAnoLongo(v.data)}` : ''}`
              : v.estado === 'pendente'
                ? 'Verificação em curso'
                : 'Ainda não verificada'}
          </p>
          <p className="mt-2 text-lg text-ink-mute">
            {verificado
              ? 'Visitámos as instalações, confirmámos a licença e comparámos os preços publicados com os entregues às famílias.'
              : 'A informação foi dada pela própria instituição. Na visita, peça para ver a licença de funcionamento e a tabela de preços.'}
          </p>
        </div>
      </div>

      <dl className="mt-12 border-t border-line">
        <Linha termo="Licença de funcionamento" valor={v.licenca ? `n.º ${v.licenca}` : 'Por indicar'} />
        <Linha termo="Natureza" valor={`${NATUREZA_LABEL[lar.natureza]}${lar.acordoSS ? ', com acordo da Segurança Social' : ''}`} />
        <Linha termo="Última inspeção conhecida" valor={v.ultimaInspecao ? dataLonga(v.ultimaInspecao) : 'Sem informação'} />
        <Linha termo="Vagas atualizadas" valor={`${dataLonga(lar.atualizadoEm)} (${tempoRelativo(lar.atualizadoEm)})`} />
        <Linha termo="Avaliações verificadas" valor={lar.reviews.length ? `${revVerificadas} de ${lar.reviews.length} publicadas` : 'Sem avaliações'} />
      </dl>

      <Link to="/sobre" className="mt-5 inline-flex min-h-12 items-center gap-0.5 text-lg text-terra-600 hover:underline">
        Como funciona a verificação
        <ChevronRight aria-hidden className="size-5" />
      </Link>
    </Secao>
  )
}
