import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Search } from 'lucide-react'
import { useDocumentTitle } from '@/lib/hooks'
import { DISTRITOS, LUGARES } from '@/data/localidades'
import { Button } from '@/components/ui/Button'
import { MoreLink, PageHero } from './shared/ui'

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** Texto livre → URL da pesquisa: concelho ou distrito conhecido, senão procura pelo nome. */
function destinoPesquisa(texto: string): string {
  const t = normalizar(texto)
  if (!t) return '/pesquisa'
  const lugar = LUGARES.find((l) => normalizar(l.label) === t)
  if (lugar) return `/pesquisa?${new URLSearchParams({ lugar: lugar.label })}`
  const distrito = DISTRITOS.find((d) => normalizar(d) === t)
  if (distrito) return `/pesquisa?${new URLSearchParams({ distrito })}`
  return `/pesquisa?${new URLSearchParams({ q: texto.trim().slice(0, 80) })}`
}

export default function NotFoundPage() {
  useDocumentTitle('Página não encontrada')
  const navigate = useNavigate()
  const [texto, setTexto] = useState('')

  const procurar = (e: FormEvent) => {
    e.preventDefault()
    navigate(destinoPesquisa(texto))
  }

  return (
    <PageHero
      eyebrow="Erro 404"
      title="Esta página não existe."
      subtitle="Pode ter mudado de endereço. Procure um lar ou siga por um destes caminhos."
      className="min-h-[60vh] justify-center pb-24 sm:pb-32"
    >
      <form role="search" onSubmit={procurar} className="mx-auto flex max-w-xl flex-col gap-3 sm:flex-row">
        <label htmlFor="nf-procurar" className="sr-only">
          Concelho, cidade ou nome do lar
        </label>
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-ink-mute" />
          <input
            id="nf-procurar"
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Concelho ou nome do lar"
            autoComplete="off"
            className="min-h-14 w-full rounded-full bg-sand pr-5 pl-13 text-lg text-ink placeholder:text-ink-mute focus:bg-white focus:ring-2 focus:ring-terra-500 focus:outline-none"
          />
        </div>
        <Button type="submit" size="lg">
          Procurar
        </Button>
      </form>
      <nav aria-label="Caminhos" className="mt-8 flex flex-wrap items-center justify-center gap-x-7">
        <MoreLink to="/">Início</MoreLink>
        <MoreLink to="/pesquisa?vaga=agora">Lares com vaga</MoreLink>
        <MoreLink to="/guia">Guia para famílias</MoreLink>
        <MoreLink to="/para-lares">Para instituições</MoreLink>
      </nav>
    </PageHero>
  )
}
