import { Link } from 'react-router'
import { ChevronRight, Phone } from 'lucide-react'
import { NATUREZA_LABEL, TIPO_LABEL } from '@/lib/labels'
import { km } from '@/lib/format'
import { PLANOS_INSTITUICAO, planoDoLar } from '@/lib/acesso'
import { cn } from '@/lib/cn'
import { contactoTexto, diaCurto, type LinhaPipeline } from '../pipeline'
import { ContactoChip, Etiqueta, NivelChip, RascunhoChip, ResultadoChip, telHref } from '../ui'

/**
 * Uma instituição no pipeline: o nome leva ao formulário da visita (o cartão inteiro é clicável).
 * Por baixo: tipo, natureza, localidade (e distância); o nível de verificação, a última visita e, conforme o
 * segmento, o próximo contacto (com atalho para ligar) ou a modalidade de quem aderiu.
 * No desktop, as etiquetas alinham numa segunda coluna (lê-se como uma tabela).
 */
export function LinhaLar({ linha, agora, rascunho }: { linha: LinhaPipeline; agora: Date; rascunho: boolean }) {
  const { lar, ultima, segmento, contacto, distanciaKm } = linha
  const plano = planoDoLar(lar)
  const ligar = segmento === 'acompanhar' && lar.telefone

  return (
    <li className="relative">
      <div className="group relative -mx-3 flex items-center gap-3 rounded-2xl px-3 py-4 transition-colors duration-200 hover:bg-sand/70 sm:-mx-4 sm:px-4">
        {/* desktop: três colunas alinhadas de linha para linha (lê-se como uma tabela); telemóvel: etiquetas por baixo do nome */}
        <div className="min-w-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem_12.5rem] lg:items-center lg:gap-6">
          <div className="min-w-0">
            <h3 className="text-lg leading-snug font-semibold">
              <Link
                to={`/visitas/${encodeURIComponent(lar.id)}`}
                className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-offset-2 focus-visible:after:outline-terra-500"
              >
                {lar.nome}
              </Link>
            </h3>
            <p className="mt-0.5 text-[0.9375rem] leading-snug text-ink-mute">
              {TIPO_LABEL[lar.tipo]} · {NATUREZA_LABEL[lar.natureza]} · {lar.localidade}
              {distanciaKm != null && <span className="font-medium whitespace-nowrap text-ink-soft"> · {km(distanciaKm)}</span>}
            </p>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2 lg:contents">
            <div className="contents lg:flex lg:flex-col lg:items-start lg:gap-1.5">
              {contacto && <ContactoChip contacto={contacto} texto={contactoTexto(contacto, ultima?.proximoContacto, agora)} />}
              {rascunho && <RascunhoChip />}
              {ultima && <ResultadoChip resultado={ultima.resultado} quando={diaCurto(ultima.data, agora)} />}
              {segmento === 'aderiram' && <Etiqueta>{plano ? PLANOS_INSTITUICAO[plano].nome : 'Sem custos'}</Etiqueta>}
            </div>
            <div className="contents lg:block">
              <NivelChip lar={lar} />
            </div>
          </div>
        </div>
        {ligar && (
          // por cima da ligação esticada do cartão: um toque liga para a instituição (acompanhamento)
          <a
            href={telHref(lar.telefone)}
            aria-label={`Ligar para ${lar.nome} (${lar.telefone})`}
            className="relative z-[1] flex size-12 shrink-0 items-center justify-center rounded-full bg-sand text-ink transition-colors hover:bg-sand-deep"
          >
            <Phone aria-hidden className="size-5" />
          </a>
        )}
        <ChevronRight aria-hidden className={cn('size-5 shrink-0 text-ink-mute transition-transform duration-200 group-hover:translate-x-0.5', ligar && 'max-sm:hidden')} />
      </div>
    </li>
  )
}
