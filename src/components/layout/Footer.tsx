import { Link } from 'react-router'
import { RotateCcw } from 'lucide-react'
import { Logo } from './Logo'
import { resetDemo } from '@/lib/store'
import { toast } from '@/components/ui/Toast'

const COLS = [
  {
    titulo: 'Para famílias',
    links: [
      { to: '/pesquisa', label: 'Pesquisar no mapa' },
      { to: '/encontrar', label: 'Encontrar o lar ideal' },
      { to: '/guia', label: 'Guia: como escolher um lar' },
      { to: '/registar', label: 'Criar conta gratuita' },
    ],
  },
  {
    titulo: 'Para instituições',
    links: [
      { to: '/para-lares', label: 'Porquê o EncontraLar' },
      { to: '/registar?tipo=lar', label: 'Registar instituição' },
      { to: '/entrar', label: 'Entrar no painel' },
    ],
  },
  {
    titulo: 'Sobre',
    links: [
      { to: '/sobre', label: 'Sobre o projeto' },
      { to: '/guia#apoios', label: 'Apoios e comparticipações' },
      { to: '/privacidade', label: 'Privacidade e dados' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="mt-auto bg-pine-950 text-pine-100">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-4">
          <Logo light />
          <p className="max-w-sm text-pine-200">
            Informação clara sobre lares e residências seniores em Portugal — com vagas atualizadas pelas próprias instituições e
            previsão de quando vão surgir novas vagas.
          </p>
        </div>
        {COLS.map((c) => (
          <nav key={c.titulo} aria-label={c.titulo}>
            <h2 className="mb-3 font-sans text-sm font-bold tracking-widest text-pine-300 uppercase">{c.titulo}</h2>
            <ul className="flex flex-col">
              {c.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="inline-flex min-h-11 items-center text-pine-50 underline-offset-4 hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-4 py-6 text-sm text-pine-300 md:flex-row md:items-center md:justify-between">
          <p className="max-w-3xl">
            Protótipo de demonstração. As instituições, pessoas, avaliações e vagas apresentadas são <strong className="text-pine-100">fictícias</strong>.
            Mapas © contribuidores OpenStreetMap, © CARTO.
          </p>
          <button
            type="button"
            onClick={() => {
              resetDemo()
              toast.success('Dados de demonstração repostos')
            }}
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-white/20 px-4 font-semibold text-pine-100 hover:bg-white/10 md:self-auto"
          >
            <RotateCcw aria-hidden className="size-4" /> Repor demonstração
          </button>
        </div>
      </div>
    </footer>
  )
}
