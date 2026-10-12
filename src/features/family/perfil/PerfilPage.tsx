import { useCallback, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Plus } from 'lucide-react'
import type { PerfilIdoso } from '@/types'
import { Avatar } from '@/components/ui/misc'
import { useMinhasCandidaturas } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { GRAU_LABEL } from '@/lib/labels'
import { tempoRelativo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { usePerfisOrdenados } from '../shared/data'
import { isAtiva } from '../shared/estado'
import { ConfirmModal } from '../shared/ui'
import { nomeCurto } from '../shared/text'
import { PerfilForm } from './PerfilForm'

type Selecao = { tipo: 'perfil'; id: string } | { tipo: 'novo' }

export default function PerfilPage() {
  useDocumentTitle('Perfil de cuidados')
  const { perfis, principal } = usePerfisOrdenados()
  const cands = useMinhasCandidaturas()
  const [params, setParams] = useSearchParams()
  const dirty = useRef(false)
  const [pendente, setPendente] = useState<Selecao | null>(null)

  const novo = params.get('novo') === '1' || perfis.length === 0
  const selecionado = novo ? undefined : (perfis.find((p) => p.id === params.get('id')) ?? perfis[0])

  const aplicar = useCallback(
    (s: Selecao) => {
      dirty.current = false
      setParams(s.tipo === 'novo' ? { novo: '1' } : { id: s.id }, { replace: true })
    },
    [setParams],
  )
  const escolher = (s: Selecao) => {
    if (dirty.current) setPendente(s)
    else aplicar(s)
  }
  const onDirty = useCallback((d: boolean) => {
    dirty.current = d
  }, [])

  const ativosDe = (p: PerfilIdoso) => cands.filter((c) => c.perfilId === p.id && isAtiva(c)).length

  return (
    <div className="flex flex-col gap-8">
      {perfis.length > 0 && (
        <section aria-labelledby="perfis-lista">
          <h2 id="perfis-lista" className="sr-only">
            Pessoas de quem cuida
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {perfis.map((p) => {
              const ativo = selecionado?.id === p.id
              const n = ativosDe(p)
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-current={ativo ? 'true' : undefined}
                    onClick={() => !ativo && escolher({ tipo: 'perfil', id: p.id })}
                    className={cn(
                      'flex w-full items-center gap-4 rounded-3xl border-2 bg-white p-4 text-left transition-colors',
                      ativo ? 'border-pine-700 shadow-card' : 'border-line hover:border-pine-400',
                    )}
                  >
                    <Avatar nome={p.nome} className={cn('size-14 text-lg', ativo && 'bg-pine-700 text-white')} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-xl leading-tight font-semibold">{nomeCurto(p.nome)}</span>
                      <span className="block text-sm text-ink-soft">
                        {p.relacao} · {p.idade} anos · {GRAU_LABEL[p.grau]}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-mute">
                        {n > 0 ? `${n === 1 ? '1 pedido ativo' : `${n} pedidos ativos`} · ` : ''}
                        atualizado {tempoRelativo(p.atualizadoEm)}
                      </span>
                    </span>
                    {p.id === principal?.id && perfis.length > 1 && (
                      <span className="self-start rounded-full bg-terra-50 px-2 text-xs font-bold text-terra-800 ring-1 ring-terra-200">principal</span>
                    )}
                  </button>
                </li>
              )
            })}
            <li>
              <button
                type="button"
                aria-current={novo ? 'true' : undefined}
                onClick={() => !novo && escolher({ tipo: 'novo' })}
                className={cn(
                  'flex h-full min-h-22 w-full items-center gap-4 rounded-3xl border-2 border-dashed p-4 text-left transition-colors',
                  novo ? 'border-pine-700 bg-pine-50' : 'border-line-strong hover:border-pine-500 hover:bg-white',
                )}
              >
                <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full bg-sand text-pine-700">
                  <Plus className="size-6" />
                </span>
                <span>
                  <span className="block font-bold">Adicionar outra pessoa</span>
                  <span className="block text-sm text-ink-soft">Ex.: pai e mãe, cada um com o seu perfil.</span>
                </span>
              </button>
            </li>
          </ul>
        </section>
      )}

      <PerfilForm
        key={selecionado?.id ?? 'novo'}
        perfil={selecionado}
        base={principal}
        onDirtyChange={onDirty}
        onSaved={(p) => aplicar({ tipo: 'perfil', id: p.id })}
        onDeleted={() => {
          dirty.current = false
          setParams({}, { replace: true })
        }}
      />

      <ConfirmModal
        open={pendente != null}
        onClose={() => setPendente(null)}
        onConfirm={() => {
          if (pendente) aplicar(pendente)
          setPendente(null)
        }}
        title="Sair sem guardar?"
        description="Tem alterações por guardar neste perfil."
        confirmLabel="Sair sem guardar"
        cancelLabel="Continuar a editar"
        confirmVariant="danger"
      >
        <p>Se mudar de perfil agora, as alterações que fez desde a última gravação perdem-se.</p>
      </ConfirmModal>
    </div>
  )
}
