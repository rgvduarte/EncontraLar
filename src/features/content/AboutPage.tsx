import { useNavigate } from 'react-router'
import type { Role } from '@/types'
import { useDocumentTitle } from '@/lib/hooks'
import { loginDemo } from '@/lib/store'
import { DEMO_FAMILIA_EMAIL, DEMO_LAR_EMAIL, DEMO_PASSWORD } from '@/data/seed'
import { Button } from '@/components/ui/Button'
import { Reveal } from '@/components/motion'
import { toast } from '@/components/ui/Toast'
import { useAnchorNavigation } from './shared/anchors'
import { useExampleLar } from './shared/useExampleLar'
import { PageHero, SectionTitle } from './shared/ui'
import { Vetores } from './sobre/Vetores'
import { Previsao } from './sobre/Previsao'
import { Problema } from './sobre/Problema'

const ROADMAP = [
  { t: 'Instituições reais, com dados confirmados por cada uma', estado: 'Próximo passo' },
  { t: 'Apoio domiciliário no mapa, ao lado de lares e centros de dia', estado: 'Planeado' },
  { t: 'Confirmação das licenças com os dados públicos da Carta Social', estado: 'Em estudo' },
  {
    t: 'Modelos de financiamento da dependência inspirados nos EUA (seguros de cuidados prolongados) e em Espanha (prestação ligada ao serviço)',
    estado: 'Em estudo',
  },
] as const

const CONTAS: { role: Role; nome: string; nota?: string; email: string; destino: string }[] = [
  // a família de demonstração tem um passe de 90 dias: mostra a experiência completa
  { role: 'familia', nome: 'Família', nota: 'Com o Acesso Família ativo.', email: DEMO_FAMILIA_EMAIL, destino: '/familia' },
  { role: 'lar', nome: 'Instituição', email: DEMO_LAR_EMAIL, destino: '/gestao' },
]

export default function AboutPage() {
  useDocumentTitle('Sobre o EncontraLar')
  useAnchorNavigation(['previsao'])
  const lar = useExampleLar()
  const navigate = useNavigate()

  const entrar = (c: (typeof CONTAS)[number]) => {
    const r = loginDemo(c.role)
    if (!r.ok) {
      toast.error('Não foi possível entrar', 'Reponha os dados de demonstração no rodapé e tente outra vez.')
      return
    }
    toast.success(`Entrou como ${r.user.nome}`, 'Conta de demonstração.')
    navigate(c.destino)
  }

  return (
    <>
      {/* 1 · gancho */}
      <PageHero
        eyebrow="Sobre o EncontraLar"
        title={
          <>
            Encontrar um lar não devia depender de <em>sorte</em>.
          </>
        }
        subtitle="Juntamos num só sítio onde há vaga, quanto custa e se a casa trata o que a pessoa precisa."
        titleWidth="max-w-[15ch]"
      />

      {/* 2 · contexto: o problema, no escuro (afirmação que se acende + galeria horizontal) */}
      <Problema />

      {/* 3–4 · a resposta, de volta à luz: três ideias com a interface real, e a previsão */}
      {lar && <Vetores lar={lar} />}
      {lar && (
        <div className="border-t border-line">
          <Previsao lar={lar} />
        </div>
      )}

      {/* 5 · desfecho: o que vem a seguir e o convite a experimentar */}
      <section aria-labelledby="sobre-roadmap" className="bg-sand">
        <div className="container-narrow py-20 sm:py-32">
          <Reveal variant="blur">
            <SectionTitle id="sobre-roadmap" title="O que vem a seguir." size="md" align="left" />
          </Reveal>
          <ul className="mt-10 flex flex-col border-b border-line-strong/70">
            {ROADMAP.map((r, i) => (
              <Reveal
                as="li"
                key={r.t}
                delay={i * 90}
                className="flex flex-col gap-1 border-t border-line-strong/70 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-10"
              >
                <span className="text-lg text-ink">{r.t}</span>
                <span className="shrink-0 text-sm text-ink-mute">{r.estado}</span>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="sobre-prototipo" className="container-narrow py-20 sm:py-32">
        <Reveal variant="blur">
          <SectionTitle
            id="sobre-prototipo"
            title="Este é um protótipo."
            subtitle="Instituições, pessoas, avaliações e vagas são fictícias. Tudo o que fizer fica guardado só neste navegador, e os pagamentos são simulados."
            size="md"
            align="left"
          />
          <ul className="mt-10 flex flex-col border-b border-line">
            {CONTAS.map((c) => (
              <li key={c.role} className="flex flex-col gap-4 border-t border-line py-5 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  <span className="block text-lg font-semibold text-ink">{c.nome}</span>
                  {c.nota && <span className="block text-base text-ink-soft">{c.nota}</span>}
                  <span className="block text-base text-ink-mute">
                    {c.email} · palavra-passe {DEMO_PASSWORD}
                  </span>
                </p>
                <Button variant="subtle" size="lg" onClick={() => entrar(c)} className="w-full sm:w-auto">
                  Entrar como {c.nome.toLowerCase()}
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-base text-ink-mute">Para ver a versão grátis, explore sem entrar ou crie uma conta.</p>
        </Reveal>
      </section>
    </>
  )
}
