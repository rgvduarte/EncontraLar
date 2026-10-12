import { Suspense, useEffect, useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { Header } from './Header'
import { Footer } from './Footer'
import { PrototypeBanner } from './PrototypeBanner'
import { MobileTabBar } from './MobileTabBar'
import { Toaster, toast } from '@/components/ui/Toast'
import { Spinner } from '@/components/ui/misc'
import { AvisoAlteracoesHost } from '@/components/ui/useAvisoAlteracoes'
import { SmoothScroll, useLenis } from '@/components/motion/SmoothScroll'
import { getDB, setAlerta, toggleFavorito, useCurrentUser } from '@/lib/store'
import { cn } from '@/lib/cn'

/** Páginas de ecrã inteiro (mapa) e fluxos focados (questionário) sem rodapé. */
const SEM_RODAPE = ['/pesquisa', '/encontrar']

/**
 * Chave da transição entre páginas: nos painéis só a secção muda (a moldura mantém-se),
 * por isso a chave é o primeiro segmento; nas restantes, o caminho completo.
 */
function chaveDaPagina(pathname: string) {
  const seg = pathname.split('/')[1] ?? ''
  return seg === 'familia' || seg === 'gestao' || seg === 'casos' ? seg : pathname
}

function ScrollParaOTopo() {
  const { pathname, hash } = useLocation()
  const lenis = useLenis()
  useEffect(() => {
    // com âncora (#secção) a própria página trata do scroll
    if (hash) return
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true })
    else window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname, hash, lenis])
  return null
}

/**
 * Ao mudar de página (só o caminho: ?passo= do questionário, filtros da pesquisa e #âncoras não contam), o foco vai
 * para o título (h1) da nova página — ou para o <main> — e o título do separador é anunciado aos leitores de ecrã.
 * Sem isto o foco ficava no <body> ou preso na ligação do rodapé/cabeçalho que se carregou (e o Tab continuava lá).
 * Não acontece no primeiro carregamento, nem quando a própria página já pôs o foco num sítio seu (autoFocus,
 * diálogo aberto ao entrar, campo do formulário). Tem de ficar ANTES do <main>: os efeitos correm por ordem.
 */
function FocoAoMudarDePagina() {
  const { pathname } = useLocation()
  const anterior = useRef<string | null>(null)
  const paginaFocou = useRef(false)
  const anuncio = useRef<HTMLParagraphElement>(null)

  // focos dentro do <main> a partir do momento em que a nova página entra = a página tratou do foco
  useLayoutEffect(() => {
    paginaFocou.current = false
  }, [pathname])
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof Element && e.target.closest('#conteudo')) paginaFocou.current = true
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [])

  useEffect(() => {
    if (anterior.current === pathname) return
    const primeira = anterior.current === null
    anterior.current = pathname
    if (primeira) return
    let anunciar: number | undefined
    const raf = requestAnimationFrame(() => {
      const main = document.getElementById('conteudo')
      const ativo = document.activeElement
      const jaTratado = paginaFocou.current && ativo && ativo !== document.body && main?.contains(ativo)
      if (main && !jaTratado) {
        const h1 = main.querySelector<HTMLElement>('h1')
        if (h1) {
          if (!h1.hasAttribute('tabindex')) {
            h1.setAttribute('tabindex', '-1')
            h1.dataset.focoPagina = ''
            h1.addEventListener(
              'blur',
              () => {
                h1.removeAttribute('tabindex')
                delete h1.dataset.focoPagina
              },
              { once: true },
            )
          }
          h1.focus({ preventScroll: true })
        } else main.focus({ preventScroll: true })
      }
      // anúncio educado depois do foco (o título já foi atualizado pelo useDocumentTitle da página)
      anunciar = window.setTimeout(() => {
        if (anuncio.current) anuncio.current.textContent = document.title
      }, 150)
    })
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(anunciar)
    }
  }, [pathname])

  return <p ref={anuncio} aria-live="polite" aria-atomic="true" className="sr-only" />
}

/**
 * Retoma o que a pessoa queria fazer antes de iniciar sessão: o coração "Guardar" e o "Avisar-me de vagas"
 * levam ?guardar=<larId> / ?alerta=<larId> no endereço de regresso. Com sessão de família, aplica-se aqui
 * (sem duplicar se já estiver feito) e o parâmetro sai do endereço. Na ficha de um lar é a própria página que o faz.
 */
function RetomarIntencao() {
  const user = useCurrentUser()
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (user?.role !== 'familia') return
    // a ficha de um lar trata das suas próprias intenções (?acao=…, ?guardar=…)
    if (location.pathname.startsWith('/lar/')) return
    const params = new URLSearchParams(location.search)
    const guardar = params.get('guardar')
    const alerta = params.get('alerta')
    if (!guardar && !alerta) return
    const existe = (id: string) => getDB().lares.some((l) => l.id === id)
    const favorito = (id: string) => getDB().favoritos.find((f) => f.userId === user.id && f.larId === id)
    if (guardar && existe(guardar) && !favorito(guardar)) {
      toggleFavorito(guardar)
      toast.success('Guardado nos seus favoritos', 'Vamos avisá-lo(a) quando houver vaga.')
    }
    if (alerta && existe(alerta) && !favorito(alerta)?.alerta) {
      setAlerta(alerta, true)
      toast.success('Alerta de vaga ligado', 'Avisamos quando abrir uma vaga.')
    }
    params.delete('guardar')
    params.delete('alerta')
    const q = params.toString()
    navigate({ pathname: location.pathname, search: q ? `?${q}` : '', hash: location.hash }, { replace: true })
  }, [user, location.pathname, location.search, location.hash, navigate])
  return null
}

export function Layout() {
  const { pathname } = useLocation()
  const comRodape = !SEM_RODAPE.includes(pathname)

  return (
    <SmoothScroll>
      <div className="flex min-h-dvh flex-col">
        <a
          href="#conteudo"
          data-fundo-do-menu
          className="sr-only-focusable fixed top-3 left-3 z-[3000] rounded-full bg-ink px-5 py-3 font-medium text-white shadow-lift"
          onClick={(e) => {
            e.preventDefault()
            document.getElementById('conteudo')?.focus()
          }}
        >
          Saltar para o conteúdo
        </a>
        <ScrollParaOTopo />
        <FocoAoMudarDePagina />
        <RetomarIntencao />
        <PrototypeBanner />
        <Header />
        {/* o espaço da barra de abas reserva-se uma só vez: no rodapé, ou aqui nas páginas sem rodapé */}
        {/* data-fundo-do-menu: fica inerte com o menu móvel aberto (Header) */}
        <main id="conteudo" tabIndex={-1} data-fundo-do-menu className={cn('flex flex-1 flex-col outline-none', !comRodape && 'pb-[var(--tabbar-h)]')}>
          <Suspense
            fallback={
              // ocupa o ecrã: o rodapé não aparece por baixo do indicador e depois salta (CLS)
              <div className="flex min-h-[calc(100dvh-4rem)] flex-1 items-center justify-center py-32">
                <Spinner />
              </div>
            }
          >
            {/* transição entre páginas: a nova página entra com fade + leve subida + desfoque */}
            <div key={chaveDaPagina(pathname)} className="flex flex-1 animate-page-in flex-col motion-reduce:animate-none">
              <Outlet />
            </div>
          </Suspense>
        </main>
        {comRodape && (
          <div className="pb-[var(--tabbar-h)] lg:pb-0" data-fundo-do-menu>
            <Footer />
          </div>
        )}
        <MobileTabBar />
        <Toaster />
        <AvisoAlteracoesHost />
      </div>
    </SmoothScroll>
  )
}
