import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { Lar } from '@/types'
import { NATUREZA_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { Bloco, Secao, Subtitulo } from '../Secao'
import { Cascata } from '../motion'
import { QUARTO_TABELA, intervaloPreco, precoSocial, type DadosLar } from '../helpers'

export function PrecosSection({ lar, dados }: { lar: Lar; dados: DadosLar }) {
  const social = precoSocial(lar)
  const unidade = dados.centroDia ? 'lugares' : 'camas'

  return (
    <Secao
      id="ficha-precos"
      rotulo="Preços"
      titulo="Quanto custa, sem letra pequena"
      intro={
        social
          ? 'A mensalidade depende dos rendimentos. Estes são os intervalos indicados pela instituição.'
          : 'Mensalidade por pessoa, tal como indicada pela instituição.'
      }
    >
      {/* tabela de preços como lista de linhas: no telemóvel empilha (tipo → preço → vagas), sem colunas apertadas */}
      <h3 className="sr-only">Mensalidade e lugares por tipo de {dados.centroDia ? 'frequência' : 'quarto'}</h3>
      <Cascata as="dl" passo={110} className="border-t border-line">
        {lar.quartos.map((q) => (
          <div key={q.tipo} className="flex flex-col border-b border-line py-5 sm:grid sm:grid-cols-[1fr_auto] sm:gap-x-6">
            <dt className="text-lg font-semibold text-ink sm:col-start-1 sm:row-start-1">
              {dados.centroDia ? 'Frequência diária' : QUARTO_TABELA[q.tipo]}
            </dt>
            <dd className="mt-1 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:text-right">
              <span className="text-3xl font-semibold tracking-tight whitespace-nowrap text-ink tabular">
                {intervaloPreco(q.precoMin, q.precoMax)}
              </span>
              <span className="ml-1.5 text-sm text-ink-mute sm:ml-0 sm:block">por mês</span>
            </dd>
            <dd className="mt-1 text-sm text-ink-mute sm:col-start-1 sm:row-start-2 sm:mt-0.5">
              {q.total} {unidade} ·{' '}
              <span className={cn(q.livres > 0 && 'font-medium text-leaf-700')}>
                {q.livres > 0 ? `${q.livres} ${q.livres === 1 ? 'livre' : 'livres'} hoje` : 'sem vaga hoje'}
              </span>
            </dd>
          </div>
        ))}
      </Cascata>

      <div className="mt-16 grid gap-12 md:grid-cols-2 md:gap-10">
        <div>
          <Bloco>
            <Subtitulo>Incluído</Subtitulo>
          </Bloco>
          {lar.incluido.length ? (
            <Cascata passo={50} className="mt-4 border-t border-line">
              {lar.incluido.map((i) => (
                <li key={i} className="border-b border-line py-3.5 text-ink">
                  {i}
                </li>
              ))}
            </Cascata>
          ) : (
            <p className="mt-3 text-ink-mute">Ainda não detalhado — pergunte na visita.</p>
          )}
        </div>
        <div>
          <Bloco delay={90}>
            <Subtitulo>Extras</Subtitulo>
          </Bloco>
          {lar.extras.length ? (
            <Cascata as="dl" passo={50} className="mt-4 border-t border-line">
              {lar.extras.map((e) => (
                <div key={e.nome} className="flex items-baseline justify-between gap-4 border-b border-line py-3.5">
                  <dt className="text-ink">{e.nome}</dt>
                  <dd className="shrink-0 text-right text-ink-mute">{e.preco}</dd>
                </div>
              ))}
            </Cascata>
          ) : (
            <p className="mt-3 text-ink-mute">Nenhum indicado. Confirme se há custos à parte (fraldas, consultas, transporte).</p>
          )}
        </div>
      </div>

      <Bloco className="mt-16 max-w-[65ch]">
        <Subtitulo>{social ? `Como se calcula numa ${NATUREZA_LABEL[lar.natureza]}` : 'Preço fixo'}</Subtitulo>
        <p className="mt-3 text-lg leading-relaxed text-ink-soft">
          {social
            ? 'A comparticipação familiar é uma percentagem dos rendimentos de quem vai entrar, até ao máximo da tabela. Leve o IRS e os comprovativos de pensão à primeira reunião — a instituição faz a simulação consigo.'
            : 'A mensalidade é igual para todas as famílias, conforme o quarto e o nível de cuidados. Parte da despesa pode ser deduzida no IRS.'}{' '}
          {lar.acordoSS ? 'Tem vagas com acordo da Segurança Social.' : 'Não tem vagas comparticipadas pela Segurança Social.'}
        </p>
        <Link to="/guia#apoios" className="mt-3 inline-flex min-h-12 items-center gap-0.5 text-lg text-terra-600 hover:underline">
          Apoios e comparticipações
          <ChevronRight aria-hidden className="size-5" />
        </Link>
      </Bloco>
    </Secao>
  )
}
