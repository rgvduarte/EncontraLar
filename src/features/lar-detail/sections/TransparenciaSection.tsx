import { Link } from 'react-router'
import { ArrowRight, ShieldQuestion } from 'lucide-react'
import type { Lar } from '@/types'
import { SeloVerificado } from '@/components/brand/SeloVerificado'
import { dataLonga, tempoRelativo } from '@/lib/format'
import { NATUREZA_LABEL } from '@/lib/labels'
import { LinhaPontilhada, Secao, Subtitulo } from '../Secao'
import { azulejoBg } from '@/components/brand/patterns'

const VERIFICAMOS = [
  { t: 'Licença de funcionamento', d: 'Confirmamos o número do alvará junto da Segurança Social e se está em vigor.' },
  { t: 'Visita às instalações', d: 'Uma pessoa da equipa visita a casa: quartos, espaços comuns, cozinha e acessibilidade.' },
  { t: 'Preços e o que incluem', d: 'Comparamos a tabela de preços publicada com a que é entregue às famílias.' },
  { t: 'Avaliações com ligação real', d: 'Só marcamos como “verificada” a avaliação de quem tem ou teve um familiar na instituição.' },
  { t: 'Vagas em dia', d: 'Pedimos à instituição que confirme as vagas todas as semanas e mostramos sempre a data.' },
]

export function TransparenciaSection({ lar, numero }: { lar: Lar; numero: number }) {
  const v = lar.verificacao
  const verificado = v.estado === 'verificado'
  const revVerificadas = lar.reviews.filter((r) => r.verificada).length

  return (
    <Secao
      id="ficha-transparencia"
      numero={numero}
      rotulo="Transparência"
      titulo={
        <>
          O que <em>verificámos</em>, e quando
        </>
      }
    >
      <div className="relative overflow-hidden rounded-3xl border-4 border-double border-line-strong bg-white">
        <div aria-hidden className="h-3 opacity-25" style={azulejoBg('#1d564e', 1, 24)} />
        <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:p-8">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.14em] text-ink-mute uppercase">Registo da instituição</p>
            <p className="mt-1 font-display text-2xl font-semibold">{lar.nome}</p>
            <dl className="mt-4">
              <LinhaPontilhada termo="Licença de funcionamento" valor={v.licenca ? `n.º ${v.licenca}` : 'Por indicar'} />
              <LinhaPontilhada termo="Natureza" valor={`${NATUREZA_LABEL[lar.natureza]}${lar.acordoSS ? ' · com acordo SS' : ''}`} />
              <LinhaPontilhada
                termo="Verificação EncontraLar"
                valor={
                  verificado
                    ? v.data
                      ? `Verificada a ${dataLonga(v.data)}`
                      : 'Verificada'
                    : v.estado === 'pendente'
                      ? 'Em curso'
                      : 'Ainda não verificada'
                }
              />
              <LinhaPontilhada termo="Última inspeção conhecida" valor={v.ultimaInspecao ? dataLonga(v.ultimaInspecao) : 'Sem informação'} />
              <LinhaPontilhada termo="Vagas atualizadas" valor={`${dataLonga(lar.atualizadoEm)} (${tempoRelativo(lar.atualizadoEm)})`} />
              <LinhaPontilhada
                termo="Avaliações verificadas"
                valor={lar.reviews.length ? `${revVerificadas} de ${lar.reviews.length} publicadas` : 'Sem avaliações'}
              />
            </dl>
          </div>
          <div className="flex items-start justify-center sm:pt-4">
            {verificado ? (
              <SeloVerificado ano={v.data ? new Date(v.data).getFullYear() : undefined} size={132} />
            ) : (
              <div className="flex size-32 flex-col items-center justify-center gap-1 rounded-full border-2 border-dashed border-line-strong text-center text-ink-mute">
                <ShieldQuestion aria-hidden className="size-8" />
                <span className="text-xs font-bold tracking-wide uppercase">{v.estado === 'pendente' ? 'Em curso' : 'Por verificar'}</span>
              </div>
            )}
          </div>
        </div>
        {!verificado && (
          <p className="border-t border-line bg-sand/60 px-6 py-4 text-ink-soft sm:px-8">
            <strong className="text-ink">Esta ficha ainda não foi verificada presencialmente.</strong> A informação foi fornecida pela própria instituição.
            Na visita, peça para ver a licença de funcionamento e a tabela de preços.
          </p>
        )}
      </div>

      <Subtitulo className="mt-10">O que verificamos numa instituição</Subtitulo>
      <ol className="mt-4 divide-y divide-line border-y border-line">
        {VERIFICAMOS.map((p, i) => (
          <li key={p.t} className="grid grid-cols-[2.5rem_1fr] gap-3 py-4 sm:grid-cols-[3rem_14rem_1fr] sm:gap-5">
            <span aria-hidden className="font-display text-3xl leading-none font-semibold text-terra-500 italic tabular">
              {i + 1}
            </span>
            <strong className="text-ink">{p.t}</strong>
            <span className="col-start-2 text-ink-soft sm:col-start-3">{p.d}</span>
          </li>
        ))}
      </ol>
      <Link to="/sobre" className="link mt-5 inline-flex items-center gap-1.5">
        Como funciona a verificação <ArrowRight aria-hidden className="size-4" />
      </Link>
    </Secao>
  )
}
