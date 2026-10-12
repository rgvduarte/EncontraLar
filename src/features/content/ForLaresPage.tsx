import { useNavigate } from 'react-router'
import type { Lar } from '@/types'
import { useDocumentTitle } from '@/lib/hooks'
import { loginDemo } from '@/lib/store'
import { DEMO_LAR_EMAIL, DEMO_PASSWORD } from '@/data/seed'
import { ButtonLink } from '@/components/ui/Button'
import { Reveal } from '@/components/ui/Reveal'
import { toast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/misc'
import { useExampleLar } from './shared/useExampleLar'
import { FaqList } from './shared/Faq'
import { MoreLink, PageHero, SectionTitle } from './shared/ui'
import { useEnsaio } from './para-lares/ensaio'
import { ProductShot } from './para-lares/ProductShot'
import { Bento } from './para-lares/Bento'
import { Verificacao } from './para-lares/Verificacao'
import { Planos } from './para-lares/Planos'
import { LARES_FAQ } from './para-lares/faq'

function useAbrirDemo() {
  const navigate = useNavigate()
  return () => {
    const r = loginDemo('lar')
    if (!r.ok) {
      toast.error('Não foi possível abrir a demonstração', 'Reponha os dados de demonstração no rodapé e tente outra vez.')
      return
    }
    toast.success('Painel de demonstração', `Entrou como ${r.user.nome}, de uma instituição fictícia.`)
    navigate('/gestao')
  }
}

function Conteudo({ lar }: { lar: Lar }) {
  const ensaio = useEnsaio(lar)
  const abrirDemo = useAbrirDemo()

  return (
    <>
      <PageHero
        eyebrow="Para instituições"
        title={
          <>
            Menos telefonemas.
            <br />
            <em>Mais vagas preenchidas.</em>
          </>
        }
        subtitle="Atualize as vagas num toque e receba pedidos com o perfil clínico já preenchido."
        className="max-w-[72rem]"
        titleWidth="max-w-none"
      >
        <div className="flex flex-col items-center justify-center gap-x-8 gap-y-3 sm:flex-row">
          <ButtonLink to="/registar?tipo=lar" size="lg">
            Registar instituição
          </ButtonLink>
          <MoreLink onClick={abrirDemo} className="text-lg">
            Ver painel de demonstração
          </MoreLink>
        </div>
      </PageHero>

      <Reveal className="container-page pb-8">
        <ProductShot base={lar} ensaio={ensaio} />
      </Reveal>

      <Bento base={lar} ensaio={ensaio} />
      <Verificacao />
      <Planos lar={lar} />

      <section aria-labelledby="pl-faq" className="container-narrow pb-24 sm:pb-32 lg:pb-40">
        <Reveal>
          <SectionTitle id="pl-faq" title="Perguntas frequentes." size="md" align="left" />
          <FaqList items={LARES_FAQ} className="mt-10" />
        </Reveal>
      </section>

      <section aria-labelledby="pl-fecho" className="on-dark bg-pine-950 text-white">
        <Reveal className="container-narrow flex flex-col items-center py-24 text-center sm:py-32 lg:py-40">
          <h2 id="pl-fecho" className="headline max-w-[18ch] text-white">
            A próxima família já está a <em>procurar</em>.
          </h2>
          <p className="mt-5 max-w-[40ch] text-xl text-pine-300 sm:text-2xl">Registe a instituição em poucos minutos.</p>
          <div className="mt-10 flex flex-col items-center gap-x-8 gap-y-3 sm:flex-row">
            <ButtonLink to="/registar?tipo=lar" variant="accent" size="lg">
              Registar instituição
            </ButtonLink>
            <MoreLink onClick={abrirDemo} className="text-lg text-terra-300 hover:text-terra-200">
              Ver painel de demonstração
            </MoreLink>
          </div>
          <p className="mt-8 text-sm text-pine-400">
            Conta de demonstração: {DEMO_LAR_EMAIL} · palavra-passe {DEMO_PASSWORD}
          </p>
        </Reveal>
      </section>
    </>
  )
}

export default function ForLaresPage() {
  useDocumentTitle('Para instituições')
  const lar = useExampleLar()
  if (!lar)
    return (
      <div className="container-narrow py-24">
        <h1 className="sr-only">Para instituições</h1>
        <EmptyState
          title="Sem dados de demonstração"
          text="Reponha os dados de demonstração no rodapé para ver esta página."
          action={<ButtonLink to="/registar?tipo=lar">Registar instituição</ButtonLink>}
        />
      </div>
    )
  return <Conteudo lar={lar} />
}
