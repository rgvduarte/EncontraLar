import { useState } from 'react'
import { ArrowDown, CheckCircle2, Pencil, RotateCcw, XCircle } from 'lucide-react'
import type { Candidatura, Caso, EstadoCaso, PerfilIdoso } from '@/types'
import { atualizarCaso, cancelarCandidatura } from '@/lib/store'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { dataLonga, plural } from '@/lib/format'
import { cn } from '@/lib/cn'
import { contagemAlta, POR_LIBERTAR, prazoTexto, resumirRespostas } from '../shared/caso'
import { Confirmar, EstadoCasoChip } from '../shared/ui'
import { EditarCaso } from './EditarCaso'

type Acao = 'colocado' | 'fechado'

/**
 * Cabeçalho do caso: contagem até à alta, estado, referência e consentimento; ações (editar, colocar, fechar, reabrir).
 * Colocar ou fechar o caso oferece-se para cancelar os pedidos ainda em curso (liberta as instituições).
 */
export function Resumo({ caso, perfil, cands, onVerRespostas }: { caso: Caso; perfil: PerfilIdoso; cands: Candidatura[]; onVerRespostas: () => void }) {
  const [editar, setEditar] = useState(false)
  const [acao, setAcao] = useState<Acao | null>(null)
  const [libertar, setLibertar] = useState(true)
  const alta = contagemAlta(caso.altaPrevista, caso.estado)
  const r = resumirRespostas(cands)
  const proposta = r.propostas[0]
  const emCurso = cands.filter((c) => POR_LIBERTAR.includes(c.estado))
  const aberto = caso.estado === 'aberto'

  const abrir = (a: Acao) => {
    setLibertar(true)
    setAcao(a)
  }

  const confirmar = () => {
    if (!acao) return
    const n = libertar ? emCurso.length : 0
    if (n) for (const c of emCurso) cancelarCandidatura(c.id)
    atualizarCaso(caso.id, { estado: acao })
    const extra = n ? ` ${n === 1 ? 'O pedido em curso foi cancelado' : `Os ${n} pedidos em curso foram cancelados`} e as instituições avisadas.` : ''
    if (acao === 'colocado') toast.success('Caso colocado', extra.trim() || 'Passa para “Colocados e fechados”.')
    else toast.info('Caso fechado', `Pode reabri-lo quando precisar.${extra}`)
    setAcao(null)
  }

  const reabrir = (estado: EstadoCaso) => {
    atualizarCaso(caso.id, { estado: 'aberto' })
    toast.info('Caso reaberto', estado === 'colocado' ? 'Pode voltar a enviá-lo a outras instituições.' : 'Já pode enviá-lo a instituições.')
  }

  return (
    <section aria-label="Resumo do caso" className="rounded-[1.75rem] bg-sand p-6 sm:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-ink-mute">Alta prevista</p>
          <p className={cn('mt-1 text-[2rem] leading-tight font-semibold tracking-tight tabular sm:text-4xl', alta.urgente ? 'text-alert-700' : 'text-ink')}>
            {alta.texto}
          </p>
          {alta.extenso && (
            <p className="mt-1 text-ink-mute">
              <span className="inline-block first-letter:uppercase">{alta.extenso}</span>
              {alta.passou && aberto && ' · já passou'}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-[0.9375rem] md:min-w-[22rem]">
          <div>
            <dt className="text-sm text-ink-mute">Estado</dt>
            <dd className="mt-1">
              <EstadoCasoChip estado={caso.estado} className="bg-white" />
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-mute">Referência</dt>
            <dd className="mt-1 font-medium tabular">{caso.referencia ?? 'Sem referência'}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-mute">Consentimento</dt>
            <dd className="mt-1 font-medium">{caso.consentimento ? `Registado a ${dataLonga(caso.criadoEm)}` : 'Em falta'}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-mute">Respostas</dt>
            <dd className="mt-1 font-medium">{r.enviados ? plural(r.enviados, 'instituição', 'instituições') : 'Ainda não enviado'}</dd>
          </div>
        </dl>
      </div>

      {proposta && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-terra-600 p-4 text-white sm:flex-row sm:items-center sm:justify-between sm:pl-5">
          <p className="leading-snug font-semibold">
            {r.propostas.length > 1 ? `${r.propostas.length} vagas propostas` : 'Vaga proposta'}
            {proposta.prazoResposta ? `: responda até ${prazoTexto(proposta.prazoResposta)}` : ': responda à instituição'}
          </p>
          <Button variant="inverse" size="md" iconRight={<ArrowDown aria-hidden />} onClick={onVerRespostas} className="shrink-0">
            Responder
          </Button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2 border-t border-black/[0.06] pt-6 max-sm:[&>*]:flex-1">
        <Button variant="secondary" icon={<Pencil aria-hidden />} onClick={() => setEditar(true)}>
          Editar
        </Button>
        {aberto ? (
          <>
            <Button variant="secondary" icon={<CheckCircle2 aria-hidden />} onClick={() => abrir('colocado')}>
              Marcar como colocado
            </Button>
            <Button variant="secondary" icon={<XCircle aria-hidden />} onClick={() => abrir('fechado')}>
              Fechar caso
            </Button>
          </>
        ) : (
          <Button variant="secondary" icon={<RotateCcw aria-hidden />} onClick={() => reabrir(caso.estado)}>
            Reabrir caso
          </Button>
        )}
      </div>

      <EditarCaso open={editar} onClose={() => setEditar(false)} caso={caso} perfil={perfil} />

      <Confirmar
        open={acao !== null}
        onClose={() => setAcao(null)}
        onConfirm={confirmar}
        title={acao === 'fechado' ? 'Fechar este caso?' : 'Marcar o caso como colocado?'}
        description={caso.referencia ?? undefined}
        confirmLabel={acao === 'fechado' ? 'Fechar caso' : 'Marcar como colocado'}
        cancelLabel="Voltar"
        confirmVariant={acao === 'fechado' ? 'danger' : 'primary'}
      >
        <p>
          {acao === 'fechado'
            ? 'Use quando a pessoa já não precisa de vaga (por exemplo, voltou para casa com apoio). Pode reabrir o caso depois.'
            : 'A pessoa tem lugar numa instituição. O caso passa para “Colocados e fechados”.'}
        </p>
        {emCurso.length > 0 && (
          <Checkbox
            checked={libertar}
            onChange={(e) => setLibertar(e.target.checked)}
            label={emCurso.length === 1 ? 'Cancelar o pedido em curso' : `Cancelar os ${emCurso.length} pedidos em curso`}
            description="As instituições são avisadas e deixam de guardar lugar para esta pessoa."
          />
        )}
      </Confirmar>
    </section>
  )
}
