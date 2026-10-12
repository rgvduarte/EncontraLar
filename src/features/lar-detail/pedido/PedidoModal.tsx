import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { ArrowLeft, ArrowRight, Check, LogIn, Send, UserPlus } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button, ButtonLink } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { candidatar, useCurrentUser, useMinhasCandidaturas, usePerfis } from '@/lib/store'
import { cn } from '@/lib/cn'
import { AuthGate, SoFamilias } from './AuthGate'
import { PerfilRapidoForm } from './PerfilRapidoForm'
import { CompatibilidadeStep } from './CompatibilidadeStep'
import { MensagemStep, type DadosEnvio } from './MensagemStep'
import { SucessoStep } from './SucessoStep'

type Passo = 'perfil' | 'compat' | 'mensagem' | 'sucesso'
const ETAPAS: { passo: Exclude<Passo, 'sucesso'>; label: string }[] = [
  { passo: 'perfil', label: 'Perfil' },
  { passo: 'compat', label: 'Compatibilidade' },
  { passo: 'mensagem', label: 'Mensagem' },
]

const ATIVOS: Candidatura['estado'][] = ['enviada', 'em_analise', 'lista_espera', 'vaga_proposta', 'aceite']

function Etapas({ atual }: { atual: Passo }) {
  const idx = ETAPAS.findIndex((e) => e.passo === atual)
  return (
    <ol className="mb-6 flex items-center gap-2" aria-label={`Passo ${idx + 1} de ${ETAPAS.length}`}>
      {ETAPAS.map((e, i) => {
        const feito = i < idx
        const agora = i === idx
        return (
          <li key={e.passo} className="flex flex-1 flex-col gap-1.5" aria-current={agora ? 'step' : undefined}>
            <span className={cn('h-1.5 rounded-full', feito ? 'bg-pine-600' : agora ? 'bg-terra-500' : 'bg-sand-deep')} />
            <span className={cn('flex items-center gap-1 text-xs font-bold', agora ? 'text-ink' : 'text-ink-mute')}>
              {feito && <Check aria-hidden className="size-3.5 text-pine-600" strokeWidth={3} />}
              <span className="sr-only">{feito ? 'Concluído: ' : agora ? 'Atual: ' : 'A seguir: '}</span>
              {i + 1}. {e.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Pedido de vaga / visita, em passos: (sem sessão → entrar) · perfil rápido · compatibilidade · mensagem e visita · confirmação.
 * Remontar com `key` a cada abertura para começar sempre do início.
 */
export function PedidoModal({ lar, open, onClose, comVisita }: { lar: Lar; open: boolean; onClose: () => void; comVisita: boolean }) {
  const user = useCurrentUser()
  const perfis = usePerfis()
  const minhas = useMinhasCandidaturas()
  const location = useLocation()
  const ids = useId().replace(/[^a-zA-Z0-9]/g, '')
  const formPerfil = `perfil-${ids}`
  const formPedido = `pedido-${ids}`

  const ativas = useMemo(() => {
    const m = new Map<string, Candidatura>()
    for (const c of minhas) if (c.larId === lar.id && ATIVOS.includes(c.estado)) m.set(c.perfilId, c)
    return m
  }, [minhas, lar.id])

  const [passo, setPasso] = useState<Passo>(() => (perfis.length ? 'compat' : 'perfil'))
  const [perfilId, setPerfilId] = useState<string>(() => perfis.find((p) => !ativas.has(p.id))?.id ?? perfis[0]?.id ?? '')
  const [enviada, setEnviada] = useState<Candidatura | null>(null)
  const corpo = useRef<HTMLDivElement>(null)

  // ao mudar de passo, volta ao topo do conteúdo do modal
  useEffect(() => {
    corpo.current?.closest('.overflow-y-auto')?.scrollTo({ top: 0 })
  }, [passo])

  const perfil = perfis.find((p) => p.id === perfilId) ?? perfis[0]
  const voltar = encodeURIComponent(location.pathname)

  const enviar = (d: DadosEnvio) => {
    if (!perfil) return
    const c = candidatar({ larId: lar.id, perfilId: perfil.id, mensagem: d.mensagem, visita: d.visita })
    if (!c) {
      toast.error('Não foi possível enviar o pedido', 'Verifique se a sessão continua iniciada e tente de novo.')
      return
    }
    setEnviada(c)
    setPasso('sucesso')
    toast.success('Pedido enviado', `${lar.nome} vai receber o perfil de ${perfil.nome.split(' ')[0]}.`)
  }

  let titulo: ReactNode
  let descricao: ReactNode
  let conteudo: ReactNode
  let rodape: ReactNode

  if (!user) {
    titulo = comVisita ? 'Entre para marcar uma visita' : 'Entre para pedir vaga'
    conteudo = <AuthGate lar={lar} />
    rodape = (
      <>
        <ButtonLink to={`/registar?voltar=${voltar}`} variant="secondary" icon={<UserPlus aria-hidden className="size-5" />}>
          Criar conta
        </ButtonLink>
        <ButtonLink to={`/entrar?voltar=${voltar}`} icon={<LogIn aria-hidden className="size-5" />}>
          Entrar
        </ButtonLink>
      </>
    )
  } else if (user.role === 'lar') {
    titulo = 'Pedidos só para famílias'
    conteudo = <SoFamilias />
    rodape = (
      <Button variant="secondary" onClick={onClose}>
        Fechar
      </Button>
    )
  } else if (passo === 'perfil' || !perfil) {
    titulo = 'Sobre a pessoa de quem cuida'
    descricao = `Passo 1 — perfil rápido para o pedido a ${lar.nome}.`
    conteudo = (
      <>
        <Etapas atual="perfil" />
        <PerfilRapidoForm
          lar={lar}
          formId={formPerfil}
          onGuardado={(p) => {
            setPerfilId(p.id)
            setPasso('compat')
          }}
        />
      </>
    )
    rodape = (
      <>
        {perfis.length > 0 && (
          <Button variant="ghost" onClick={() => setPasso('compat')} icon={<ArrowLeft aria-hidden className="size-5" />}>
            Voltar
          </Button>
        )}
        <Button type="submit" form={formPerfil} iconRight={<ArrowRight aria-hidden className="size-5" />}>
          Guardar e continuar
        </Button>
      </>
    )
  } else if (passo === 'compat') {
    const ja = ativas.get(perfil.id)
    titulo = comVisita ? 'Marcar visita' : 'Pedir vaga'
    descricao = `Antes de enviar, veja se ${lar.nome} responde às necessidades.`
    conteudo = (
      <>
        <Etapas atual="compat" />
        <CompatibilidadeStep
          lar={lar}
          perfis={perfis}
          perfilId={perfil.id}
          onEscolher={setPerfilId}
          ativas={ativas}
          onNovoPerfil={() => setPasso('perfil')}
        />
      </>
    )
    rodape = ja ? (
      <ButtonLink to="/familia/pedidos" iconRight={<ArrowRight aria-hidden className="size-5" />}>
        Ver o pedido
      </ButtonLink>
    ) : (
      <Button onClick={() => setPasso('mensagem')} iconRight={<ArrowRight aria-hidden className="size-5" />}>
        Continuar
      </Button>
    )
  } else if (passo === 'mensagem') {
    titulo = comVisita ? 'Mensagem e visita' : 'Mensagem para a instituição'
    descricao = `Pedido para ${perfil.nome}.`
    conteudo = (
      <>
        <Etapas atual="mensagem" />
        <MensagemStep lar={lar} perfil={perfil} user={user} formId={formPedido} comVisitaInicial={comVisita} onEnviar={enviar} />
      </>
    )
    rodape = (
      <>
        <Button variant="ghost" onClick={() => setPasso('compat')} icon={<ArrowLeft aria-hidden className="size-5" />}>
          Voltar
        </Button>
        <Button type="submit" form={formPedido} icon={<Send aria-hidden className="size-5" />}>
          Enviar pedido
        </Button>
      </>
    )
  } else {
    titulo = 'Pedido enviado'
    conteudo = enviada ? <SucessoStep lar={lar} c={enviada} /> : null
    rodape = (
      <>
        <Button variant="ghost" onClick={onClose}>
          Continuar na ficha
        </Button>
        <ButtonLink to="/familia/pedidos" iconRight={<ArrowRight aria-hidden className="size-5" />}>
          Ver os meus pedidos
        </ButtonLink>
      </>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={titulo} description={descricao} footer={rodape} size="lg">
      <div ref={corpo}>{conteudo}</div>
    </Modal>
  )
}
