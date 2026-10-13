import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { Lar } from '@/types'
import { AvisoAcesso } from '@/components/acesso'
import { NATUREZA_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { Bloco, Secao, Subtitulo } from '../Secao'
import { Cascata } from '../motion'
import { QUARTO_TABELA, caminhoFicha, faixaPrecoPartes, intervaloPreco, precoSocial, type DadosLar } from '../helpers'

/**
 * Quanto custa. Versão grátis (`completo` falso): a faixa de preço (`faixaPreco`), o que está incluído, os extras
 * (sem valores) e as regras em termos gerais. Os preços por quarto, os lugares livres e os valores dos extras são do
 * Acesso Família e não vão para o DOM.
 */
export function PrecosSection({ lar, dados, completo }: { lar: Lar; dados: DadosLar; completo: boolean }) {
  const social = precoSocial(lar)
  // sem acordo com a Segurança Social, uma IPSS/Misericórdia não calcula a comparticipação pelos rendimentos
  const porRendimentos = social && lar.acordoSS
  const unidade = dados.centroDia ? 'lugares' : 'camas'

  return (
    <Secao
      id="ficha-precos"
      rotulo="Preços"
      titulo="Quanto custa, sem letra pequena"
      intro={
        !completo
          ? 'O que se paga por mês, o que está incluído e o que fica à parte.'
          : porRendimentos
            ? 'A mensalidade depende dos rendimentos. Estes são os intervalos indicados pela instituição.'
            : social
              ? 'Intervalos indicados pela instituição. O valor de cada pessoa segue o regulamento interno.'
              : 'Mensalidade por pessoa, tal como indicada pela instituição.'
      }
    >
      {completo ? (
        <>
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
        </>
      ) : (
        <FaixaGratis lar={lar} />
      )}

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
            completo ? (
              <Cascata as="dl" passo={50} className="mt-4 border-t border-line">
                {lar.extras.map((e) => (
                  <div key={e.nome} className="flex items-baseline justify-between gap-4 border-b border-line py-3.5">
                    <dt className="text-ink">{e.nome}</dt>
                    <dd className="shrink-0 text-right text-ink-mute">{e.preco}</dd>
                  </div>
                ))}
              </Cascata>
            ) : (
              // versão grátis: o que se paga à parte, sem os valores
              <Cascata passo={50} className="mt-4 border-t border-line">
                {lar.extras.map((e) => (
                  <li key={e.nome} className="border-b border-line py-3.5 text-ink">
                    {e.nome}
                  </li>
                ))}
              </Cascata>
            )
          ) : (
            <p className="mt-3 text-ink-mute">Nenhum indicado. Confirme se há custos à parte (fraldas, consultas, transporte).</p>
          )}
        </div>
      </div>

      <Bloco className="mt-16 max-w-[65ch]">
        <Subtitulo>{social ? `Como se calcula numa ${NATUREZA_LABEL[lar.natureza]}` : 'Preço fixo'}</Subtitulo>
        <p className="mt-3 text-lg leading-relaxed text-ink-soft">
          {porRendimentos
            ? 'Tem vagas com acordo da Segurança Social: a comparticipação familiar é uma percentagem dos rendimentos de quem vai entrar, até ao máximo da tabela. Leve o IRS e os comprovativos de pensão à primeira reunião — a instituição faz a simulação consigo.'
            : social
              ? 'Sem acordo com a Segurança Social: o preço é definido pela instituição. Peça o regulamento interno para saber como se calcula.'
              : lar.acordoSS
                ? 'Nas vagas privadas, a mensalidade é igual para todas as famílias, conforme o quarto e o nível de cuidados. Também tem vagas com acordo da Segurança Social, em que a comparticipação depende dos rendimentos.'
                : 'A mensalidade é igual para todas as famílias, conforme o quarto e o nível de cuidados. Parte da despesa pode ser deduzida no IRS. Não tem vagas comparticipadas pela Segurança Social.'}
        </p>
        <Link to="/guia#apoios" className="mt-3 inline-flex min-h-12 items-center gap-0.5 text-lg text-terra-600 hover:underline">
          Apoios e comparticipações
          <ChevronRight aria-hidden className="size-5" />
        </Link>
      </Bloco>
    </Secao>
  )
}

/** Versão grátis: a faixa de preço em grande e, numa linha, onde estão os preços de cada quarto. */
function FaixaGratis({ lar }: { lar: Lar }) {
  const { valor, sufixo } = faixaPrecoPartes(lar)
  return (
    <Bloco>
      <div className="border-t border-line pt-6">
        <p className="text-sm text-ink-mute">{sufixo ? 'Faixa de preço' : 'Mensalidade'}</p>
        <p className="mt-1 text-ink">
          <span className="text-[2rem] leading-tight font-semibold tracking-tight sm:text-5xl">{valor}</span>
          {sufixo && <span className="ml-2 text-lg whitespace-nowrap text-ink-mute">por mês</span>}
        </p>
        <AvisoAcesso texto="Preços por quarto com o Acesso Família" voltar={caminhoFicha(lar)} className="mt-3" />
      </div>
    </Bloco>
  )
}
