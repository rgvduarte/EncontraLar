/**
 * /profissionais — apresentação do canal profissional (assistentes sociais de hospitais, centros de saúde, autarquias).
 * O mesmo estilo das páginas de conteúdo: título grande, uma ideia por secção, o produto real como imagem.
 */
import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useDB, useCurrentUser, loginDemo } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { DEMO_PASSWORD, DEMO_PRO_EMAIL, DEMO_PRO_ID } from '@/data/seed'
import { Button, ButtonLink } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { Reveal, ScrollZoom } from '@/components/motion'
import { cn } from '@/lib/cn'
import { MoreLink, PageHero, SectionTitle } from '@/features/content/shared/ui'
import { contagemAlta, ordenarRespostas, pessoaCurta, resumirRespostas, ultimaNotaDoLar } from './shared/caso'
import { CasoCard } from './lista/CasoCard'
import { EstadoPedido } from './shared/ui'

const PASSOS = [
  {
    t: 'Um perfil de cuidados',
    d: 'Grau de dependência, cuidados de saúde, zona, orçamento e a data prevista de alta. Basta o primeiro nome ou as iniciais.',
  },
  {
    t: 'Instituições compatíveis, com vaga real',
    d: 'Vê quem assegura os cuidados no raio que escolher, quem tem vaga para quem pede hoje e a previsão para os próximos meses. Escolhe várias e envia de uma vez.',
  },
  {
    t: 'As respostas num só sítio',
    d: 'Quem abriu o pedido, quem está a analisar, quem propõe vaga e até quando. Aceita a vaga e confirma a entrada no mesmo ecrã.',
  },
] as const

const ANTES = [
  'Faixa etária (por exemplo, 80–84 anos), nunca a idade exata',
  'Grau de dependência e cuidados necessários',
  'Zona e orçamento',
  'Data prevista de alta, com «Encaminhado por» e o nome do seu serviço',
] as const

const DEPOIS = ['Nome e perfil completo, com as notas', 'A mensagem que escreveu', 'O seu contacto, para combinar a entrada'] as const

/** Entrar com a conta de demonstração — sem terminar a sessão de outra pessoa. */
function useDemo(): { to?: string; onClick?: () => void; label: string } {
  const user = useCurrentUser()
  const navigate = useNavigate()
  if (user?.role === 'profissional') return { to: '/casos', label: 'Abrir os meus casos' }
  if (user) return { to: '/entrar?voltar=/casos', label: 'Experimentar com a conta de demonstração' }
  return {
    label: 'Experimentar com a conta de demonstração',
    onClick: () => {
      const r = loginDemo('profissional')
      if (!r.ok) {
        toast.error('Não foi possível abrir a demonstração', 'Reponha os dados de demonstração no rodapé e tente outra vez.')
        return
      }
      toast.success('Conta de demonstração', `Entrou como ${r.user.nome}, de um hospital fictício.`)
      navigate('/casos')
    },
  }
}

function Acoes({ tom = 'claro', className }: { tom?: 'claro' | 'escuro'; className?: string }) {
  const demo = useDemo()
  const escuro = tom === 'escuro'
  return (
    <div className={cn('mx-auto flex w-full max-w-sm flex-col items-stretch gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:items-center sm:justify-center', className)}>
      {demo.to ? (
        <ButtonLink to={demo.to} size="lg" variant={escuro ? 'inverse' : 'primary'} className="w-full sm:w-auto">
          {demo.label}
        </ButtonLink>
      ) : (
        <Button size="lg" variant={escuro ? 'inverse' : 'primary'} onClick={demo.onClick} className="w-full sm:w-auto">
          {demo.label}
        </Button>
      )}
      <ButtonLink to="/registar?tipo=profissional" size="lg" variant={escuro ? 'glass' : 'subtle'} className="w-full sm:w-auto">
        Criar conta
      </ButtonLink>
    </div>
  )
}

/** O produto como imagem: o caso de demonstração (dados fictícios do protótipo), como aparece na conta. */
function Produto() {
  const db = useDB()
  const dados = useMemo(() => {
    const caso = db.casos.find((c) => c.profissionalId === DEMO_PRO_ID && c.estado === 'aberto' && db.candidaturas.some((x) => x.encaminhamento?.casoId === c.id))
    const perfil = caso && db.perfis.find((p) => p.id === caso.perfilId)
    if (!caso || !perfil) return null
    const cands = db.candidaturas.filter((c) => c.encaminhamento?.casoId === caso.id)
    const nomes = new Map(db.lares.map((l) => [l.id, l.nome]))
    return { caso, perfil, cands, nomes }
  }, [db])
  if (!dados) return null
  const { caso, perfil, cands, nomes } = dados

  return (
    <div className="container-page pb-20 sm:pb-28 lg:pb-36">
      <ScrollZoom from={0.92} className="bg-sand">
        {/* imagem do produto: lida como uma só descrição (os cartões são ilustração, sem ligações) */}
        <figure
          role="img"
          aria-label={`Exemplo de um caso na conta de demonstração: ${pessoaCurta(perfil)}, ${contagemAlta(caso.altaPrevista, caso.estado).texto.toLowerCase()}; ${resumirRespostas(cands).texto}.`}
          className="grid gap-4 p-4 sm:p-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6 lg:p-12"
        >
          <div className="pointer-events-none select-none">
            <CasoCard caso={caso} perfil={perfil} cands={cands} estatico headingLevel="h3" />
          </div>
          <div className="pointer-events-none rounded-[1.75rem] bg-white p-6 ring-1 ring-line select-none sm:p-7">
            <p className="text-xl font-semibold">Respostas</p>
            <ul className="mt-4 flex flex-col divide-y divide-line">
              {ordenarRespostas(cands).map((c) => {
                const nota = ultimaNotaDoLar(c)
                return (
                  <li key={c.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <p className="min-w-0 font-semibold">{nomes.get(c.larId)}</p>
                      <p className="shrink-0 text-[0.9375rem]">
                        <EstadoPedido estado={c.estado} />
                      </p>
                    </div>
                    {nota && <p className="mt-1 text-[0.9375rem] text-ink-mute">“{nota.nota}”</p>}
                  </li>
                )
              })}
            </ul>
          </div>
          <figcaption className="text-center text-sm text-ink-mute lg:col-span-2">Caso de demonstração, com dados fictícios.</figcaption>
        </figure>
      </ScrollZoom>
    </div>
  )
}

function Bloco({ id, titulo, children }: { id: string; titulo: ReactNode; children: ReactNode }) {
  return (
    <Reveal as="section" variant="fade" duration={800} aria-labelledby={id} className="border-t border-line py-12 sm:py-16">
      <h2 id={id} className="text-3xl font-semibold text-ink sm:text-4xl">
        {titulo}
      </h2>
      <div className="mt-5 flex flex-col gap-4 text-lg leading-relaxed text-ink-soft [&_strong]:font-semibold [&_strong]:text-ink">{children}</div>
    </Reveal>
  )
}

export default function ProfissionaisPage() {
  useDocumentTitle('Para profissionais')

  return (
    <>
      {/* 1 · gancho */}
      <PageHero
        eyebrow="Para assistentes sociais"
        title={['Vaga para quem tem alta,', <em key="em">sem dezenas de telefonemas.</em>]}
        subtitle="Um perfil de cuidados, várias instituições com vaga, as respostas num só sítio."
        className="max-w-[72rem]"
        titleWidth="max-w-[18ch]"
      >
        <Acoes />
      </PageHero>

      {/* 2 · o produto */}
      <Produto />

      {/* 3 · percurso */}
      <section aria-labelledby="pro-como" className="container-page pb-20 sm:pb-32 lg:pb-40">
        <Reveal variant="blur">
          <SectionTitle id="pro-como" title="Como funciona." subtitle="Três passos, do perfil à entrada." />
        </Reveal>
        <ol className="mx-auto mt-14 grid max-w-5xl gap-10 sm:mt-20 md:grid-cols-3 md:gap-8">
          {PASSOS.map((p, i) => (
            <Reveal as="li" key={p.t} delay={i * 110} className="flex flex-col gap-3">
              <span aria-hidden className="text-5xl font-semibold text-ink-mute tabular">
                {i + 1}
              </span>
              <h3 className="text-2xl font-semibold text-ink">
                <span className="sr-only">Passo {i + 1}: </span>
                {p.t}
              </h3>
              <p className="text-lg text-ink-mute">{p.d}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* 4 · o que a instituição vê (privacidade em duas fases) */}
      <section aria-labelledby="pro-privacidade" className="bg-sand">
        <div className="container-page py-20 sm:py-32 lg:py-40">
          <Reveal variant="blur">
            <SectionTitle
              id="pro-privacidade"
              title="Sem dados pessoais até a instituição aceitar."
              subtitle="Primeiro um resumo sem identificação. O resto, só depois de «Aceitar e ver contacto»."
            />
          </Reveal>
          <div className="mx-auto mt-14 grid max-w-5xl gap-4 sm:mt-20 md:grid-cols-2">
            <Reveal className="rounded-[1.75rem] bg-white p-7 sm:p-10">
              <h3 className="text-2xl font-semibold">Antes de aceitar</h3>
              <ul className="mt-5 flex flex-col gap-3 text-lg text-ink-soft">
                {ANTES.map((t) => (
                  <li key={t} className="flex gap-3">
                    <span aria-hidden className="mt-3 size-1.5 shrink-0 rounded-full bg-ink-mute" />
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={120} className="on-dark rounded-[1.75rem] bg-pine-950 p-7 text-white sm:p-10">
              <h3 className="text-2xl font-semibold text-white">Depois de aceitar</h3>
              <ul className="mt-5 flex flex-col gap-3 text-lg text-white/80">
                {DEPOIS.map((t) => (
                  <li key={t} className="flex gap-3">
                    <span aria-hidden className="mt-3 size-1.5 shrink-0 rounded-full bg-white/70" />
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <p className="mx-auto mt-8 max-w-[52ch] text-center text-lg text-ink-mute">
            Os pedidos com alta prevista nos próximos 7 dias aparecem primeiro na lista da instituição.
          </p>
        </div>
      </section>

      {/* 5 · consentimento e custo */}
      <div className="container-narrow py-20 sm:py-32">
        <div className="mx-auto max-w-[44rem]">
          <Bloco id="pro-consentimento" titulo="Com o consentimento da pessoa.">
            <p>
              Os dados de saúde são dados sensíveis. Antes de criar um caso, confirma que a pessoa, ou o seu representante legal, autorizou a partilha
              do perfil de cuidados com as instituições que escolher. <strong>Sem essa confirmação, o caso não é criado.</strong>
            </p>
            <p>Só recebe o pedido quem escolher. Pode cancelar um pedido a qualquer momento, e a instituição é avisada.</p>
            <MoreLink to="/privacidade" className="self-start">
              Política de privacidade
            </MoreLink>
          </Bloco>
          <Bloco id="pro-gratuito" titulo="Gratuito para profissionais.">
            <p>Não paga nada para criar casos, enviá-los ou acompanhar as respostas.</p>
            <p>
              Também não há posições pagas: <strong>nenhuma instituição paga para aparecer primeiro</strong>, e a ordem das compatíveis segue só o
              perfil de cuidados, a distância, o orçamento e a vaga.
            </p>
            <MoreLink to="/como-ordenamos" className="self-start">
              Como ordenamos
            </MoreLink>
          </Bloco>
        </div>
      </div>

      {/* 6 · desfecho */}
      <section aria-labelledby="pro-fecho">
        <ScrollZoom from={0.9} radiusTo={0} className="on-dark bg-pine-950 text-white">
          <div className="container-narrow flex flex-col items-center py-20 text-center sm:py-32 lg:py-40">
            <Reveal variant="blur">
              <h2 id="pro-fecho" className="headline max-w-[18ch] text-white">
                Experimente com um caso <em>fictício</em>.
              </h2>
            </Reveal>
            <Reveal variant="blur" delay={120}>
              <p className="mt-5 max-w-[40ch] text-xl text-pine-300 sm:text-2xl">A conta de demonstração tem casos por enviar, à espera de resposta e já colocados.</p>
            </Reveal>
            <Reveal delay={240} className="mt-10 w-full">
              <Acoes tom="escuro" />
            </Reveal>
            <p className="mt-8 text-sm text-pine-400">
              Conta de demonstração: {DEMO_PRO_EMAIL} · palavra-passe {DEMO_PASSWORD}
            </p>
          </div>
        </ScrollZoom>
      </section>
    </>
  )
}
