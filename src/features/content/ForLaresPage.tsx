import { useNavigate } from 'react-router'
import { ArrowRight, Building2, LayoutDashboard, Smartphone, Wallet } from 'lucide-react'
import { useDocumentTitle } from '@/lib/hooks'
import { loginDemo } from '@/lib/store'
import { DEMO_LAR_EMAIL, DEMO_PASSWORD } from '@/data/seed'
import { Button, ButtonLink } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { Spinner } from '@/components/ui/misc'
import { azulejoBg, calcadaStonesBg } from '@/components/brand/patterns'
import { useExampleLar } from './shared/useExampleLar'
import { FaqList } from './shared/Faq'
import { HeroPanel } from './para-lares/HeroPanel'
import { ProblemsSection } from './para-lares/ProblemsSection'
import { VerificationSection } from './para-lares/VerificationSection'
import { PlansSection } from './para-lares/PlansSection'
import { LARES_FAQ } from './para-lares/faq'

export default function ForLaresPage() {
  useDocumentTitle('Para instituições')
  const lar = useExampleLar()
  const navigate = useNavigate()

  const abrirDemo = () => {
    const r = loginDemo('lar')
    if (!r.ok) {
      toast.error('Não foi possível abrir a demonstração', 'Reponha os dados de demonstração (no rodapé) e tente outra vez.')
      return
    }
    toast.success('Entrou no painel de demonstração', `Conta de ${r.user.nome}, gestora de uma instituição fictícia.`)
    navigate('/gestao')
  }

  return (
    <>
      {/* ——— Hero: nas palavras de quem gere um lar, com o painel verdadeiro ao lado */}
      <section aria-labelledby="pl-titulo" className="relative overflow-hidden">
        <div className="container-page grid gap-14 pt-12 pb-16 sm:pt-16 sm:pb-24 lg:grid-cols-12 lg:gap-10 lg:pt-20 lg:pb-24">
          <div className="flex min-w-0 flex-col gap-7 lg:col-span-7 lg:pt-6 lg:pr-8">
            <p className="eyebrow flex items-center gap-2">
              <Building2 aria-hidden className="size-4" /> Para diretores técnicos e direções de lares
            </p>
            <h1 id="pl-titulo" className="text-[2.5rem] leading-[1.06] font-semibold text-ink sm:text-5xl lg:text-[3.9rem]">
              Quantas vezes por semana atende o telefone para dizer que <em>não há vaga</em>?
            </h1>
            <p className="max-w-[52ch] text-lg leading-relaxed text-ink-soft sm:text-xl">
              O EncontraLar mostra as suas vagas às famílias no momento em que as atualiza — e entrega-lhe pedidos já com o perfil clínico de
              quem precisa. Menos chamadas em vão, quartos vazios durante menos tempo.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink to="/registar?tipo=lar" size="lg" className="whitespace-normal! text-center sm:whitespace-nowrap!" iconRight={<ArrowRight aria-hidden className="size-5" />}>
                Registar a instituição
              </ButtonLink>
              <Button size="lg" variant="secondary" onClick={abrirDemo} className="whitespace-normal! text-center sm:whitespace-nowrap!" icon={<LayoutDashboard aria-hidden className="size-5" />}>
                Ver painel de demonstração
              </Button>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-ink-soft">
              <li className="flex items-center gap-2">
                <Wallet aria-hidden className="size-5 text-pine-700" /> Plano Essencial gratuito
              </li>
              <li className="flex items-center gap-2">
                <Smartphone aria-hidden className="size-5 text-pine-700" /> Funciona no telemóvel, sem instalar nada
              </li>
            </ul>
          </div>

          <div className="relative min-w-0 lg:col-span-5">
            <div
              aria-hidden
              className="absolute -inset-x-4 top-10 bottom-24 rounded-[2.5rem] bg-pine-50 sm:-inset-x-8 lg:top-4 lg:right-[-7rem] lg:left-12"
              style={azulejoBg('#1d564e', 0.13, 44)}
            />
            {lar ? (
              <HeroPanel lar={lar} className="relative" />
            ) : (
              <div className="relative flex min-h-80 items-center justify-center rounded-[1.75rem] bg-white shadow-lift">
                <Spinner />
              </div>
            )}
          </div>
        </div>
      </section>

      {lar && <ProblemsSection lar={lar} />}

      <VerificationSection />

      <PlansSection lar={lar} />

      {/* ——— Perguntas frequentes */}
      <section aria-labelledby="pl-faq" className="bg-sand">
        <div className="container-page grid gap-10 py-20 sm:py-24 lg:grid-cols-12">
          <div className="self-start lg:sticky lg:top-28 lg:col-span-4">
            <p className="eyebrow">Perguntas frequentes</p>
            <h2 id="pl-faq" className="mt-3 text-4xl font-semibold text-ink">
              O que as direções nos <em>perguntam</em>
            </h2>
            <p className="mt-4 text-lg text-ink-soft">Não encontra a sua dúvida? Experimente o painel de demonstração — tudo o que lá vê funciona.</p>
          </div>
          <FaqList items={LARES_FAQ} tone="sand" className="lg:col-span-8" />
        </div>
      </section>

      {/* ——— Fecho */}
      <section aria-labelledby="pl-fecho" className="container-page py-16 sm:py-20">
        <div className="on-dark relative grid overflow-hidden rounded-[2rem] bg-pine-900 text-pine-50 shadow-lift lg:grid-cols-[minmax(0,1fr)_9rem]">
          <div className="absolute inset-0" style={calcadaStonesBg('#ffffff', 0.04)} aria-hidden />
          <div className="relative grid gap-10 p-8 sm:p-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end lg:gap-12 lg:p-14">
            <div>
              <h2 id="pl-fecho" className="text-4xl font-semibold text-white sm:text-5xl">
                A próxima família que procura uma casa como a sua <em>já está</em> a pesquisar.
              </h2>
              <p className="mt-5 max-w-[56ch] text-lg text-pine-200">
                Registe a instituição em poucos minutos. Para espreitar primeiro, a conta de demonstração é{' '}
                <span className="font-bold text-white">{DEMO_LAR_EMAIL}</span> com a palavra-passe{' '}
                <span className="font-bold text-white">{DEMO_PASSWORD}</span>.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <ButtonLink to="/registar?tipo=lar" variant="accent" size="lg" full iconRight={<ArrowRight aria-hidden className="size-5" />}>
                Registar a instituição
              </ButtonLink>
              <button
                type="button"
                onClick={abrirDemo}
                className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border-2 border-white/25 px-4 text-base font-bold sm:text-lg text-white transition-colors hover:border-white/60 hover:bg-white/5"
              >
                <LayoutDashboard aria-hidden className="size-5" /> Ver painel de demonstração
              </button>
            </div>
          </div>
          <div aria-hidden className="relative hidden border-l-4 border-terra-500 bg-pine-800 lg:block" style={azulejoBg('#d6ebe5', 0.4, 56)} />
        </div>
      </section>
    </>
  )
}
