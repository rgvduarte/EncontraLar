import { useMemo } from 'react'
import { Link } from 'react-router'
import { Lock, Map } from 'lucide-react'
import type { Candidatura } from '@/types'
import type { PerfilInput } from '@/lib/store'
import { ButtonLink } from '@/components/ui/Button'
import { useLares } from '@/lib/store'
import { recomendar } from '@/lib/matching'
import { vagasLivres } from '@/lib/forecast'
import { useDebounced } from '@/lib/hooks'
import { euro } from '@/lib/format'
import { pesquisaUrl } from '../shared/data'
import { isAtiva } from '../shared/estado'

/** Pré-visualização ao vivo: quantas instituições servem este perfil, com vaga e dentro do orçamento. */
export function PerfilPreview({ form }: { form: PerfilInput }) {
  const lares = useLares()
  const f = useDebounced(form, 300)
  const stats = useMemo(() => {
    const dentro = recomendar(lares, f, 400).filter((m) => m.compativel && m.distanciaKm <= f.raioKm)
    const precos = dentro.map((m) => m.precoRef).sort((a, b) => a - b)
    const ids = new Set(dentro.map((m) => m.larId))
    return {
      compativeis: dentro.length,
      comVaga: lares.filter((l) => ids.has(l.id) && vagasLivres(l) > 0).length,
      noOrcamento: dentro.filter((m) => m.precoRef <= f.orcamentoMax).length,
      mediana: precos.length ? precos[Math.floor(precos.length / 2)]! : null,
      min: precos[0] ?? null,
    }
  }, [lares, f])

  const linhas = [
    { n: stats.compativeis, t: stats.compativeis === 1 ? 'instituição compatível' : 'instituições compatíveis', d: `a até ${f.raioKm} km de ${f.local.label}` },
    { n: stats.comVaga, t: stats.comVaga === 1 ? 'tem vaga agora' : 'têm vaga agora', d: 'segundo as próprias instituições' },
    { n: stats.noOrcamento, t: 'dentro do orçamento', d: `até ${euro(f.orcamentoMax)}/mês` },
  ]

  return (
    <section aria-labelledby="perfil-preview" className="rounded-[1.75rem] border border-line bg-white p-6 shadow-card">
      <p className="eyebrow">Ao vivo</p>
      <h2 id="perfil-preview" className="mt-1 font-display text-xl font-semibold">
        Com estes critérios
      </h2>
      <dl className="mt-4 flex flex-col" aria-live="polite">
        {linhas.map((l) => (
          <div key={l.t} className="grid grid-cols-[3.5rem_1fr] items-baseline gap-3 border-t border-dashed border-line py-3 first:border-t-0 first:pt-0">
            <dd className="order-first font-display text-4xl leading-none font-semibold text-pine-800 tabular">{l.n}</dd>
            <dt>
              <span className="block font-bold">{l.t}</span>
              <span className="block text-sm text-ink-soft">{l.d}</span>
            </dt>
          </div>
        ))}
      </dl>
      {stats.mediana != null ? (
        <p className="mt-2 rounded-2xl bg-sand px-4 py-3 text-sm text-ink-soft">
          Nas compatíveis, a mensalidade começa em <strong className="text-ink">{euro(stats.min!)}</strong>; a mediana é{' '}
          <strong className="text-ink">{euro(stats.mediana)}</strong>.
        </p>
      ) : (
        <p className="mt-2 rounded-2xl bg-sun-50 px-4 py-3 text-sm text-sun-800">
          Nenhuma instituição cumpre todos os requisitos nesta zona. Experimente alargar o raio ou rever os cuidados essenciais.
        </p>
      )}
      <ButtonLink to={pesquisaUrl(f)} variant="subtle" full className="mt-4" icon={<Map aria-hidden className="size-5" />}>
        Ver no mapa de vagas
      </ButtonLink>
    </section>
  )
}

/** Aviso de privacidade concreto: com quem este perfil já foi partilhado. */
export function PrivacidadePerfil({ partilhas }: { partilhas: { c: Candidatura; nome: string }[] }) {
  const ativas = partilhas.filter((p) => isAtiva(p.c))
  return (
    <section aria-labelledby="perfil-privacidade" className="rounded-[1.75rem] border border-pine-200 bg-pine-50 p-6">
      <p className="flex items-center gap-2 text-pine-800">
        <Lock aria-hidden className="size-5" />
        <span id="perfil-privacidade" className="font-display text-xl font-semibold">
          Quem vê estes dados
        </span>
      </p>
      <p className="mt-2 text-sm text-ink-soft">
        Informação de saúde é um dado sensível (RGPD, art. 9.º). Só a partilhamos com as instituições a quem pede vaga — nunca com
        terceiros nem para publicidade.
      </p>
      {ativas.length > 0 ? (
        <>
          <p className="mt-3 text-sm font-bold">Partilhado com:</p>
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {ativas.map((p) => (
              <li key={p.c.id}>
                <Link to={`/familia/pedidos#pedido-${p.c.id}`} className="link">
                  {p.nome}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink-soft">
            Os pedidos guardam os dados do momento em que foram enviados. Se algo importante mudar (uma queda, nova medicação),
            avise também essas instituições.
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm font-semibold text-pine-800">Ainda não foi partilhado com nenhuma instituição.</p>
      )}
      <Link to="/privacidade" className="link mt-3 inline-flex min-h-11 items-center text-sm">
        Política de privacidade
      </Link>
    </section>
  )
}
