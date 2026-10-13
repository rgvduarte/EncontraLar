import { useCallback, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Lock, Plus } from 'lucide-react'
import { Avatar } from '@/components/ui/misc'
import { AvisoAcesso } from '@/components/acesso'
import { useAcesso } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { cn } from '@/lib/cn'
import { usePerfisOrdenados } from '../shared/data'
import { ConfirmModal } from '../shared/ui'
import { nomeCurto } from '../shared/text'
import { PerfilForm } from './PerfilForm'

type Selecao = { tipo: 'perfil'; id: string } | { tipo: 'novo' }

const pillCls = (ativo: boolean) =>
  cn(
    'inline-flex min-h-14 items-center gap-3 rounded-full py-1.5 pr-5 pl-1.5 font-medium transition-colors duration-200',
    ativo ? 'bg-ink text-white' : 'bg-sand text-ink hover:bg-sand-deep',
  )

export default function PerfilPage() {
  useDocumentTitle('Perfil de cuidados')
  const { perfis, principal } = usePerfisOrdenados()
  const [params, setParams] = useSearchParams()
  const dirty = useRef(false)
  const [pendente, setPendente] = useState<Selecao | null>(null)
  // o perfil é sempre gratuito; depois de o guardar, a versão grátis diz numa linha o que o passe faz com ele
  const { completo } = useAcesso()
  const [guardadoId, setGuardadoId] = useState<string | null>(null)

  const novo = params.get('novo') === '1' || perfis.length === 0
  const selecionado = novo ? undefined : (perfis.find((p) => p.id === params.get('id')) ?? perfis[0])

  const aplicar = useCallback(
    (s: Selecao) => {
      dirty.current = false
      setParams(s.tipo === 'novo' ? { novo: '1' } : { id: s.id }, { replace: true })
    },
    [setParams],
  )
  const escolher = (s: Selecao) => (dirty.current ? setPendente(s) : aplicar(s))
  const onDirty = useCallback((d: boolean) => {
    dirty.current = d
  }, [])

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-5">
        {perfis.length > 0 && (
          <nav aria-label="Pessoas de quem cuida">
            {/* telemóvel: faixa deslizável (sem quebrar linha); desktop: pílulas em linha */}
            <ul
              data-lenis-prevent-horizontal
              className="relative -mx-5 flex snap-x scroll-px-5 gap-2 overflow-x-auto overscroll-x-contain overscroll-y-auto! px-5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
            >
              {perfis.map((p) => {
                const ativo = selecionado?.id === p.id
                return (
                  <li key={p.id} className="shrink-0 snap-start">
                    <button
                      type="button"
                      aria-current={ativo ? 'true' : undefined}
                      onClick={() => !ativo && escolher({ tipo: 'perfil', id: p.id })}
                      className={pillCls(ativo)}
                    >
                      <Avatar nome={p.nome} className="size-11 text-base" />
                      <span>
                        {nomeCurto(p.nome)}
                        <span className={cn('ml-2 tabular', ativo ? 'text-white/60' : 'text-ink-mute')}>{p.idade}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
              <li className="shrink-0 snap-start">
                <button type="button" aria-current={novo ? 'true' : undefined} onClick={() => !novo && escolher({ tipo: 'novo' })} className={pillCls(novo)}>
                  <span aria-hidden className={cn('flex size-11 items-center justify-center rounded-full', novo ? 'bg-white/15' : 'bg-white')}>
                    <Plus className="size-5" />
                  </span>
                  Outra pessoa
                </button>
              </li>
            </ul>
          </nav>
        )}
        {novo && (
          <p className="text-xl text-ink-soft">
            {perfis.length ? 'Outra pessoa de quem cuida, com o seu próprio perfil.' : 'Leva dois minutos. Pode mudar tudo depois.'}
          </p>
        )}
        <p className="flex items-start gap-2 text-sm text-ink-mute">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            Dados de saúde (RGPD, art. 9.º): só os partilhamos com as instituições a quem pedir vaga.{' '}
            <Link to="/privacidade" className="link">
              Privacidade
            </Link>
          </span>
        </p>
      </div>

      <PerfilForm
        key={selecionado?.id ?? 'novo'}
        perfil={selecionado}
        base={principal}
        onDirtyChange={onDirty}
        onSaved={(p) => {
          setGuardadoId(p.id)
          aplicar({ tipo: 'perfil', id: p.id })
        }}
        depoisDeGuardar={
          !completo && guardadoId != null && guardadoId === selecionado?.id ? (
            <AvisoAcesso texto="Com o Acesso Família, envia este perfil a várias casas de uma vez." voltar="/familia/perfil" />
          ) : undefined
        }
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
        confirmLabel="Sair sem guardar"
        cancelLabel="Continuar a editar"
        confirmVariant="danger"
      >
        <p>As alterações que fez neste perfil perdem-se.</p>
      </ConfirmModal>
    </div>
  )
}
