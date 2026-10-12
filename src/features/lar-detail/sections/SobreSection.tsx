import type { Lar } from '@/types'
import { TextReveal } from '@/components/motion'
import { COMODIDADES_ORDEM, COMODIDADE_LABEL, NATUREZA_DESCRICAO, NATUREZA_LABEL, TIPO_DESCRICAO, TIPO_LABEL } from '@/lib/labels'
import { Bloco, Numero, Secao, Subtitulo } from '../Secao'
import { Cascata, Contador } from '../motion'
import type { DadosLar } from '../helpers'

/**
 * "Contexto": a frase-resumo da instituição acende-se palavra a palavra com o scroll (o único TextReveal
 * da página), seguida dos números-chave a contar e da apresentação.
 */
export function SobreSection({ lar, dados }: { lar: Lar; dados: DadosLar }) {
  const paragrafos = lar.descricao
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  const comodidades = COMODIDADES_ORDEM.filter((c) => lar.comodidades.includes(c))
  const anos = lar.fundacao ? new Date().getFullYear() - lar.fundacao : 0
  const resumo = lar.resumo?.trim()

  return (
    <Secao id="ficha-sobre" rotulo="Sobre" titulo="Conhecer a casa">
      {resumo && (
        <TextReveal
          text={resumo}
          dim={0.2}
          className="mb-14 max-w-3xl text-[1.75rem] leading-[1.2] font-semibold tracking-tight text-ink sm:mb-16 sm:text-4xl sm:leading-[1.15]"
        />
      )}

      {(lar.capacidade > 0 || lar.fundacao > 0) && (
        <Cascata as="dl" passo={120} className="grid grid-cols-2 gap-8 sm:gap-12">
          {lar.capacidade > 0 && (
            <Numero
              valor={<Contador valor={lar.capacidade} />}
              rotulo="lugares"
              nota={dados.centroDia ? 'de frequência diária' : 'capacidade licenciada'}
            />
          )}
          {lar.fundacao > 0 && (
            <Numero valor={lar.fundacao} rotulo="ano de fundação" nota={anos > 1 ? `há ${anos} anos` : anos === 1 ? 'há 1 ano' : 'abriu este ano'} />
          )}
        </Cascata>
      )}

      <Bloco>
        {paragrafos.length ? (
          <div className="mt-12 max-w-[65ch] space-y-5 text-lg leading-relaxed text-ink-soft">
            {paragrafos.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : (
          <p className="mt-12 max-w-[65ch] text-lg text-ink-mute">
            A instituição ainda não escreveu a sua apresentação. Ligue e pergunte como é o dia a dia — ou marque uma visita.
          </p>
        )}
      </Bloco>

      <Cascata as="dl" passo={110} className="mt-12 grid gap-8 border-t border-line pt-8 sm:grid-cols-2 sm:gap-10">
        {[
          { termo: 'Tipo', valor: TIPO_LABEL[lar.tipo], texto: TIPO_DESCRICAO[lar.tipo] },
          { termo: 'Natureza', valor: NATUREZA_LABEL[lar.natureza], texto: NATUREZA_DESCRICAO[lar.natureza] },
        ].map((f) => (
          <div key={f.termo}>
            <dt className="text-sm text-ink-mute">{f.termo}</dt>
            <dd className="mt-1 text-lg font-semibold text-ink">{f.valor}</dd>
            <dd className="mt-1 text-base text-ink-soft">{f.texto}</dd>
          </div>
        ))}
      </Cascata>

      {comodidades.length > 0 && (
        <div className="mt-14">
          <Bloco>
            <Subtitulo>{dados.centroDia ? 'No centro' : 'Na casa'}</Subtitulo>
          </Bloco>
          <Cascata passo={50} className="mt-4 grid border-t border-line sm:grid-cols-2 sm:gap-x-10">
            {comodidades.map((c) => (
              <li key={c} className="border-b border-line py-3.5 text-ink">
                {COMODIDADE_LABEL[c]}
              </li>
            ))}
          </Cascata>
        </div>
      )}
    </Secao>
  )
}
