import { useId, useState } from 'react'
import { ArrowUpRight, ChevronDown, Navigation, Phone } from 'lucide-react'
import type { Lar, User, Visita } from '@/types'
import { buttonClasses } from '@/components/ui/Button'
import { SeloNiveis } from '@/components/brand/SeloVerificado'
import { compromissoAte, PLANOS_INSTITUICAO, planoDoLar } from '@/lib/acesso'
import { dataLonga, diaPorExtenso } from '@/lib/format'
import { cn } from '@/lib/cn'
import { comoChegarHref, ResultadoChip, telHref } from '../ui'

/** Quantas visitas anteriores se veem logo (as outras ficam atrás de "Ver mais"). */
const VISIVEIS = 2

/** O que se confirmou numa visita, numa frase curta ("licença, instalações e vagas"). */
function confirmou(v: Visita['verificacao']): string | null {
  const itens = [v.licencaConfirmada && 'licença', v.instalacoesVistas && 'instalações', v.vagasConfirmadas && 'vagas', v.precosConfirmados && 'preços'].filter(Boolean) as string[]
  if (!itens.length) return null
  return itens.length === 1 ? itens[0]! : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`
}

function VisitaAnterior({ v, users }: { v: Visita; users: readonly User[] }) {
  const quem = users.find((u) => u.id === v.equipaId)?.nome
  const ok = confirmou(v.verificacao)
  const r = v.responsavel
  const detalhes = [
    v.proximoContacto && (v.resultado === 'interessado' || v.resultado === 'voltar') ? `Contacto combinado: ${diaPorExtenso(v.proximoContacto)}` : null,
    v.plano ? `Modalidade: ${PLANOS_INSTITUICAO[v.plano].nome}` : null,
    r?.nome ? `Responsável: ${r.nome}${r.cargo ? ` (${r.cargo})` : ''}` : null,
    ok ? `Confirmou: ${ok}` : null,
  ].filter(Boolean)
  return (
    <li className="rounded-[1.25rem] bg-sand p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <ResultadoChip resultado={v.resultado} className="bg-white" />
        <span className="text-sm text-ink-mute">
          {dataLonga(v.data)}
          {quem && ` · ${quem}`}
        </span>
      </div>
      {v.notas && <p className="mt-2.5 leading-snug text-ink">{v.notas}</p>}
      {detalhes.length > 0 && <p className="mt-1.5 text-sm leading-snug text-ink-mute">{detalhes.join(' · ')}</p>}
    </li>
  )
}

/**
 * (a) A instituição antes de entrar: ligar e "como chegar" ao alcance do polegar, a morada, a verificação de hoje,
 * se já tem conta (e a modalidade) e as visitas anteriores com as notas.
 */
export function Instituicao({ lar, visitas, users }: { lar: Lar; visitas: readonly Visita[]; users: readonly User[] }) {
  const [todas, setTodas] = useState(false)
  const listaId = useId()
  // a modalidade só existe para quem já está na plataforma (aderiu ou gere a ficha); antes disso, nada a mostrar
  const plano = lar.planoInstituicao || lar.ownerId ? planoDoLar(lar) : null
  const ate = compromissoAte(lar)
  const mostradas = todas ? visitas : visitas.slice(0, VISIVEIS)
  const escondidas = visitas.length - VISIVEIS

  return (
    <section aria-labelledby="instituicao-titulo">
      <h2 id="instituicao-titulo" className="sr-only">
        A instituição
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        {lar.telefone && (
          <a href={telHref(lar.telefone)} className={buttonClasses('primary', 'md', 'w-full sm:w-auto')}>
            <Phone aria-hidden />
            Ligar<span className="sr-only"> para {lar.nome}</span>
          </a>
        )}
        <a href={comoChegarHref(lar)} target="_blank" rel="noopener noreferrer" className={buttonClasses('subtle', 'md', 'w-full sm:w-auto')}>
          <Navigation aria-hidden />
          Como chegar
          <ArrowUpRight aria-hidden className="-ml-1 text-ink-mute" />
          <span className="sr-only"> (abre o Google Maps noutro separador)</span>
        </a>
      </div>

      <dl className="mt-8 grid gap-x-10 gap-y-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-ink-mute">Morada</dt>
          <dd className="mt-0.5 leading-snug">
            {lar.morada ? `${lar.morada}, ` : ''}
            <span className="whitespace-nowrap">{[lar.codigoPostal, lar.localidade].filter(Boolean).join(' ')}</span>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-mute">Telefone</dt>
          <dd className="mt-0.5">
            {lar.telefone ? (
              <a href={telHref(lar.telefone)} className="link inline-flex min-h-11 items-center tabular">
                {lar.telefone}
              </a>
            ) : (
              <span className="text-ink-mute">Sem telefone na ficha</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-mute">Verificação hoje</dt>
          <dd className="mt-2">
            <SeloNiveis lar={lar} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-mute">No EncontraLar</dt>
          <dd className="mt-0.5 leading-snug">
            {lar.ownerId ? 'Já gere a ficha (tem conta).' : 'Ainda sem conta: ninguém gere a ficha.'}
            {plano && (
              <span className="mt-1 block text-ink-soft">
                Modalidade: {PLANOS_INSTITUICAO[plano].nome}
                {lar.planoDesde && ` desde ${dataLonga(lar.planoDesde)}`}
                {ate && Date.parse(ate) > Date.now() && ` · compromisso até ${dataLonga(ate)}`}
              </span>
            )}
            {lar.natureza !== 'privado' && <span className="mt-1 block text-ink-soft">Setor social: sem custos.</span>}
          </dd>
        </div>
      </dl>

      <div className="mt-10">
        <h3 className="text-xl font-semibold">
          Visitas anteriores <span className="font-normal text-ink-mute tabular">{visitas.length}</span>
        </h3>
        {visitas.length === 0 ? (
          <p className="mt-2 text-ink-mute">Primeira visita a esta instituição.</p>
        ) : (
          <>
            <ol id={listaId} className="mt-4 flex flex-col gap-3">
              {mostradas.map((v) => (
                <VisitaAnterior key={v.id} v={v} users={users} />
              ))}
            </ol>
            {escondidas > 0 && (
              <button type="button" aria-expanded={todas} aria-controls={listaId} onClick={() => setTodas((t) => !t)} className="link mt-2 inline-flex min-h-11 items-center gap-1">
                {todas ? 'Ver menos' : escondidas === 1 ? 'Ver a visita mais antiga' : `Ver as ${escondidas} mais antigas`}
                <ChevronDown aria-hidden className={cn('size-4 transition-transform duration-300', todas && 'rotate-180')} />
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}
