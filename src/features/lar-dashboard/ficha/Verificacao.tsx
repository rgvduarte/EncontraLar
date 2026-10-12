import { Check } from 'lucide-react'
import type { Lar } from '@/types'
import { SeloVerificado } from '@/components/brand/SeloVerificado'
import { dataLonga } from '@/lib/format'
import { cn } from '@/lib/cn'

/** Estado da verificação EncontraLar: selo, ou os passos que faltam. */
export function Verificacao({ lar }: { lar: Lar }) {
  const v = lar.verificacao
  if (v.estado === 'verificado') {
    return (
      <section id="verificacao" aria-labelledby="verificacao-titulo" className="flex items-center gap-5 scroll-mt-28">
        <SeloVerificado size={56} ano={v.data ? new Date(v.data).getFullYear() : undefined} />
        <div>
          <h2 id="verificacao-titulo" className="text-xl font-semibold">
            Instituição verificada
          </h2>
          <p className="text-ink-mute">
            {v.data ? `Visita e documentos confirmados a ${dataLonga(v.data)}` : 'Visita e documentos confirmados'}
            {v.licenca ? ` · licença n.º ${v.licenca}` : ''}.
          </p>
        </div>
      </section>
    )
  }

  const passos = [
    { titulo: 'Registo da instituição', texto: 'Feito.', feito: true },
    {
      titulo: v.licenca ? `Licença de funcionamento n.º ${v.licenca}` : 'Licença de funcionamento',
      texto: v.licenca ? 'Em análise pela nossa equipa.' : 'Envie o número da licença para verificacao@encontralar.pt.',
      feito: false,
    },
    { titulo: 'Visita às instalações', texto: 'Combinamos a data consigo depois de analisar a licença.', feito: false },
  ]
  return (
    <section id="verificacao" aria-labelledby="verificacao-titulo" className="tile scroll-mt-28">
      <h2 id="verificacao-titulo" className="text-xl font-semibold">
        Verificação em curso
      </h2>
      <p className="mt-1 text-ink-mute">A ficha já aparece nas pesquisas. O selo de verificado surge quando os três passos estiverem feitos.</p>
      <ol className="mt-5 flex flex-col gap-4">
        {passos.map((p, i) => (
          <li key={p.titulo} className="flex items-start gap-3">
            <span
              aria-hidden
              className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold', p.feito ? 'bg-leaf-500 text-white' : 'bg-white text-ink')}
            >
              {p.feito ? <Check className="size-4" strokeWidth={3} /> : i + 1}
            </span>
            <div>
              <p className="font-medium">
                {p.titulo}
                <span className="sr-only">{p.feito ? ' (feito)' : ' (por fazer)'}</span>
              </p>
              <p className="text-sm text-ink-mute">{p.texto}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
