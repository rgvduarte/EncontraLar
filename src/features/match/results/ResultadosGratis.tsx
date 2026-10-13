import { ACESSO_SEM_PRIORIDADE, LinhasBloqueadas } from '@/components/acesso'
import { plural } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * Para onde voltar depois de ativar o Acesso Família: as sugestões. As respostas vivem no sessionStorage do
 * separador (useMatchSession), por isso a lista aparece completa ao voltar, sem repetir o questionário.
 */
export const VOLTAR_RESULTADOS = '/encontrar?vista=resultados'

/**
 * Sugestões na versão grátis: os números ficam no resumo (quantas são, quantas têm vaga agora); a lista em si
 * (nomes, preços, vagas) é do Acesso Família e não chega ao DOM — só linhas com a forma do conteúdo e o convite.
 */
export function ResultadosGratis({
  n,
  longe,
  raio,
  instituicao,
  className,
}: {
  /** compatíveis dentro do raio */
  n: number
  /** compatíveis mais longe do que o raio */
  longe: number
  raio: number
  /** conta de instituição: vê a versão grátis, mas o convite não é para ela */
  instituicao: boolean
  className?: string
}) {
  const maisLonge =
    longe > 0 &&
    (n > 0
      ? `E mais ${plural(longe, 'compatível', 'compatíveis')} a mais de ${raio} km.`
      : `Há ${plural(longe, 'instituição compatível', 'instituições compatíveis')} a mais de ${raio} km.`)

  return (
    <div className={className}>
      {n > 0 && (
        <>
          <LinhasBloqueadas
            n={Math.min(n, 4)}
            rotulo={n === 1 ? 'Qual é, com vaga, preço e contactos' : `Quais são as ${n}, com vaga, preço e contactos`}
            voltar={VOLTAR_RESULTADOS}
          />
          {!instituicao && (
            <p className="mx-auto mt-6 max-w-xl text-center text-sm text-ink-mute">
              As respostas ficam guardadas neste separador: depois de ativar, volta a estas sugestões e vê a lista completa, pela
              mesma ordem. {ACESSO_SEM_PRIORIDADE}
            </p>
          )}
        </>
      )}
      {maisLonge && <p className={cn('text-ink-mute', n > 0 ? 'mt-10 border-t border-line pt-6' : 'mt-0')}>{maisLonge}</p>}
    </div>
  )
}
