import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
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
const ETAPAS: Exclude<Passo, 'sucesso'>[] = ['perfil', 'compat', 'mensagem']
const ATIVOS: Candidatura['estado'][] = ['enviada', 'em_analise', 'lista_espera', 'vaga_proposta', 'aceite']
/** Botões do rodapé maiores na folha inferior do telemóvel (alvo confortável para o polegar). */
const GRANDE = 'max-sm:min-h-14 max-sm:text-lg'

/** Ordem das vistas, para saber para que lado desliza a transição. */
type Vista = Passo | 'entrar' | 'so-familias'
const ORDEM: Record<Vista, number> = { entrar: -1, 'so-familias': -1, perfil: 0, compat: 1, mensagem: 2, sucesso: 3 }

/** Progresso discreto: três traços finos que enchem (só transform) + "Passo 2 de 3". */
function Etapas({ atual }: { atual: Passo }) {
  const idx = ETAPAS.indexOf(atual as (typeof ETAPAS)[number])
  if (idx < 0) return null
  return (
    <div className="mb-7">
      <div aria-hidden className="flex gap-1.5">
        {ETAPAS.map((e, i) => (
          <span key={e} className="h-1 flex-1 overflow-hidden rounded-full bg-sand-deep">
            <span
              className={cn(
                'block h-full origin-left rounded-full bg-ink transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none',
                i <= idx ? 'scale-x-100' : 'scale-x-0',
              )}
            />
          </span>
        ))}
      </div>
      <p className="mt-2 text-sm text-ink-mute">
        Passo {idx + 1} de {ETAPAS.length}
      </p>
    </div>
  )
}

/**
 * Pedido de vaga / visita, em passos: (sem sessão → entrar) · perfil rápido (se não houver) · compatibilidade ·
 * mensagem, visita e consentimento · confirmação. Remontar com `key` a cada abertura para começar do início.
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

  // o passo e o perfil derivam do estado atual (a sessão pode ser iniciada dentro do próprio modal)
  const [escolhido, setPasso] = useState<Passo | null>(null)
  const [perfilEscolhido, setPerfilId] = useState('')
  const [enviada, setEnviada] = useState<Candidatura | null>(null)
  const perfil =
    perfis.find((p) => p.id === perfilEscolhido) ?? perfis.find((p) => !ativas.has(p.id)) ?? perfis[0]
  const passo: Passo = escolhido ?? (perfis.length ? 'compat' : 'perfil')
  const corpo = useRef<HTMLDivElement>(null)

  // transição entre passos: desliza para a esquerda ao avançar e para a direita ao voltar
  const vista: Vista = !user ? 'entrar' : user.role === 'lar' ? 'so-familias' : passo === 'perfil' || !perfil ? 'perfil' : passo
  const [vistaAnterior, setVistaAnterior] = useState(vista)
  const [direcao, setDirecao] = useState<'frente' | 'tras' | null>(null)
  if (vistaAnterior !== vista) {
    setVistaAnterior(vista)
    setDirecao(ORDEM[vista] >= ORDEM[vistaAnterior] ? 'frente' : 'tras')
  }

  // ao mudar de passo, volta ao topo do conteúdo do modal
  useEffect(() => {
    corpo.current?.closest('.overflow-y-auto')?.scrollTo({ top: 0 })
  }, [passo])

  const voltar = encodeURIComponent(location.pathname)
  const primeiro = perfil?.nome.split(' ')[0]

  const enviar = (d: DadosEnvio) => {
    if (!perfil) return
    const c = candidatar({ larId: lar.id, perfilId: perfil.id, mensagem: d.mensagem, visita: d.visita })
    if (!c) {
      toast.error('Não foi possível enviar o pedido', 'Verifique se a sessão continua iniciada e tente de novo.')
      return
    }
    setEnviada(c)
    setPasso('sucesso')
    toast.success('Pedido enviado', `${lar.nome} recebeu o pedido para ${primeiro}.`)
  }

  let titulo: ReactNode
  let descricao: ReactNode
  let conteudo: ReactNode
  let rodape: ReactNode

  if (!user) {
    titulo = comVisita ? 'Entre para marcar visita' : 'Entre para pedir vaga'
    descricao = 'É gratuito e demora um minuto.'
    conteudo = <AuthGate lar={lar} />
    rodape = (
      <>
        <ButtonLink className={GRANDE} to={`/registar?voltar=${voltar}`} variant="subtle">
          Criar conta
        </ButtonLink>
        <ButtonLink className={GRANDE} to={`/entrar?voltar=${voltar}`}>Entrar</ButtonLink>
      </>
    )
  } else if (user.role === 'lar') {
    titulo = 'Só para famílias'
    conteudo = <SoFamilias />
    rodape = (
      <Button className={GRANDE} variant="subtle" onClick={onClose}>
        Fechar
      </Button>
    )
  } else if (passo === 'perfil' || !perfil) {
    titulo = 'Para quem é?'
    descricao = 'Um perfil rápido. Fica guardado para outros pedidos.'
    conteudo = (
      <PerfilRapidoForm
        lar={lar}
        formId={formPerfil}
        onGuardado={(p) => {
          setPerfilId(p.id)
          setPasso('compat')
        }}
      />
    )
    rodape = (
      <>
        {perfis.length > 0 && (
          <Button className={GRANDE} variant="subtle" onClick={() => setPasso('compat')}>
            Voltar
          </Button>
        )}
        <Button className={GRANDE} type="submit" form={formPerfil}>
          Guardar e continuar
        </Button>
      </>
    )
  } else if (passo === 'compat') {
    const ja = ativas.get(perfil.id)
    titulo = comVisita ? 'Marcar visita' : 'Pedir vaga'
    descricao = `Veja se ${lar.nome} responde ao que ${primeiro} precisa.`
    conteudo = (
      <CompatibilidadeStep lar={lar} perfis={perfis} perfil={perfil} onEscolher={setPerfilId} ativas={ativas} onNovoPerfil={() => setPasso('perfil')} />
    )
    rodape = ja ? (
      <ButtonLink className={GRANDE} to="/familia/pedidos">Ver o pedido</ButtonLink>
    ) : (
      <Button className={GRANDE} onClick={() => setPasso('mensagem')}>Continuar</Button>
    )
  } else if (passo === 'mensagem') {
    titulo = comVisita ? 'Mensagem e visita' : 'Mensagem'
    descricao = `Pedido para ${perfil.nome}.`
    conteudo = <MensagemStep lar={lar} perfil={perfil} user={user} formId={formPedido} comVisitaInicial={comVisita} onEnviar={enviar} />
    rodape = (
      <>
        <Button className={GRANDE} variant="subtle" onClick={() => setPasso('compat')}>
          Voltar
        </Button>
        <Button className={GRANDE} type="submit" form={formPedido}>
          Enviar pedido
        </Button>
      </>
    )
  } else {
    titulo = 'Pedido enviado'
    conteudo = enviada ? <SucessoStep lar={lar} c={enviada} /> : null
    rodape = (
      <>
        <Button className={GRANDE} variant="subtle" onClick={onClose}>
          Fechar
        </Button>
        <ButtonLink className={GRANDE} to="/familia/pedidos">Ver os meus pedidos</ButtonLink>
      </>
    )
  }

  const animar = direcao !== null
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span key={vista} className={cn('block', animar && 'ficha-troca')}>
          {titulo}
        </span>
      }
      description={descricao}
      footer={rodape}
      size="lg"
    >
      <div ref={corpo}>
        {(vista === 'perfil' || vista === 'compat' || vista === 'mensagem') && <Etapas atual={vista} />}
        {/* a margem negativa deixa ver os anéis de foco; o recorte horizontal evita barra de scroll durante o deslize */}
        <div className="-mx-2 overflow-x-clip px-2">
          <div key={vista} data-dir={direcao ?? undefined} className={cn(animar && 'ficha-passo')}>
            {conteudo}
          </div>
        </div>
      </div>
    </Modal>
  )
}
