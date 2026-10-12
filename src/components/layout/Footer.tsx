import { Link } from 'react-router'
import { resetDemo } from '@/lib/store'
import { toast } from '@/components/ui/Toast'

const COLS = [
  {
    titulo: 'Famílias',
    links: [
      { to: '/pesquisa', label: 'Mapa de vagas' },
      { to: '/encontrar', label: 'Ajuda-me a escolher' },
      { to: '/guia', label: 'Guia e apoios' },
      { to: '/registar', label: 'Criar conta' },
    ],
  },
  {
    titulo: 'Instituições',
    links: [
      { to: '/para-lares', label: 'Porquê o EncontraLar' },
      { to: '/registar?tipo=lar', label: 'Registar instituição' },
      { to: '/entrar', label: 'Entrar no painel' },
    ],
  },
  {
    titulo: 'EncontraLar',
    links: [
      { to: '/sobre', label: 'Sobre o projeto' },
      { to: '/sobre#previsao', label: 'Como calculamos a previsão' },
      { to: '/privacidade', label: 'Privacidade' },
    ],
  },
]

/** Rodapé discreto, estilo Apple: cinza claro, texto pequeno, colunas simples. */
export function Footer() {
  return (
    <footer className="mt-auto bg-sand text-ink-mute">
      <div className="container-page py-14">
        <div className="grid gap-10 sm:grid-cols-3 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <p className="max-w-sm text-sm leading-relaxed sm:col-span-3 lg:col-span-1">
            Lares e residências seniores em Portugal, com vagas atualizadas pelas próprias instituições e previsão de quando
            vai abrir a próxima vaga.
          </p>
          {COLS.map((c) => (
            <nav key={c.titulo} aria-label={c.titulo}>
              <h2 className="mb-2 font-sans text-sm font-semibold tracking-normal text-ink">{c.titulo}</h2>
              <ul className="flex flex-col">
                {c.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="inline-flex min-h-10 items-center text-sm hover:text-ink hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-line-strong/60 pt-6 text-xs leading-relaxed md:flex-row md:items-center md:justify-between">
          <p className="max-w-3xl">
            Protótipo de demonstração. Instituições, pessoas, avaliações e vagas são fictícias. Mapas © OpenStreetMap, © CARTO.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <button
              type="button"
              onClick={() => {
                resetDemo()
                toast.success('Dados de demonstração repostos')
              }}
              className="inline-flex min-h-10 items-center text-xs text-ink-mute hover:text-ink hover:underline"
            >
              Repor dados de demonstração
            </button>
            <a
              href="https://www.buildity.pt"
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-10 items-center text-xs text-ink-mute transition-colors hover:text-ink"
            >
              by Buildity
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
