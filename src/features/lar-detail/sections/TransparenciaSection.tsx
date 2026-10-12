import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { Lar } from '@/types'
import { SeloNiveis, SeloVerificado } from '@/components/brand/SeloVerificado'
import { dataLonga, tempoRelativo } from '@/lib/format'
import { NATUREZA_LABEL } from '@/lib/labels'
import { Reveal } from '@/components/motion'
import { Bloco, Linha, Secao } from '../Secao'
import { Cascata } from '../motion'

const mesAnoLongo = (iso: string) => new Date(iso).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })

export function TransparenciaSection({ lar }: { lar: Lar }) {
  const v = lar.verificacao
  const verificado = v.estado === 'verificado'
  const revVerificadas = lar.reviews.filter((r) => r.verificada).length

  return (
    <Secao id="ficha-transparencia" rotulo="Transparência" titulo="O que verificámos, e quando">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        {verificado && (
          <Reveal variant="scale" duration={900} className="shrink-0 self-start sm:self-auto">
            <SeloVerificado ano={v.data ? new Date(v.data).getFullYear() : undefined} size={88} />
          </Reveal>
        )}
        <Reveal variant="up" delay={120} className="max-w-xl">
          <p className="text-[1.625rem] leading-tight font-semibold tracking-tight text-ink sm:text-2xl">
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
        </Reveal>
      </div>

      {/* os três níveis (licença · visita · avaliações de quem entrou), do mais básico ao mais exigente */}
      <Bloco delay={180} className="mt-10">
        <SeloNiveis lar={lar} className="sm:flex-row sm:flex-wrap sm:gap-x-8" />
      </Bloco>

      <Cascata as="dl" passo={80} className="mt-12 border-t border-line">
        <Linha termo="Licença de funcionamento" valor={v.licenca ? `n.º ${v.licenca}` : 'Por indicar'} />
        <Linha termo="Natureza" valor={`${NATUREZA_LABEL[lar.natureza]}${lar.acordoSS ? ', com acordo da Segurança Social' : ''}`} />
        <Linha termo="Última inspeção conhecida" valor={v.ultimaInspecao ? dataLonga(v.ultimaInspecao) : 'Sem informação'} />
        <Linha termo="Vagas atualizadas" valor={`${dataLonga(lar.atualizadoEm)} (${tempoRelativo(lar.atualizadoEm)})`} />
        <Linha
          termo="Avaliações verificadas"
          nota="De famílias cuja entrada foi confirmada"
          valor={lar.reviews.length ? `${revVerificadas} de ${lar.reviews.length} publicadas` : 'Sem avaliações'}
        />
      </Cascata>

      <Bloco>
        <Link to="/sobre" className="mt-5 inline-flex min-h-12 items-center gap-0.5 text-lg text-terra-600 hover:underline">
          Como funciona a verificação
          <ChevronRight aria-hidden className="size-5" />
        </Link>
      </Bloco>
    </Secao>
  )
}
