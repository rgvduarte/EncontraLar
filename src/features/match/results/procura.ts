/**
 * Procura sem resposta a partir do questionário: quando a zona do perfil não tem nenhuma instituição compatível
 * com vaga agora, fica um registo anónimo para as instituições da zona ("procura na sua zona").
 * Sai só o que se procurou (distrito, lugar, grau, cuidados, orçamento): nunca o nome, a idade, coordenadas nem notas.
 */
import { LUGARES } from '@/data/localidades'
import { distanceKm } from '@/lib/geo'
import type { ProcuraSemVaga } from '@/features/search/procura'
import { semLimiteOrcamento, type PerfilMatch } from '../model'
import { LABEL_GPS } from '../language'

/** Distrito (e nome do lugar) do local do perfil. "A sua localização" dá só o distrito do lugar conhecido mais próximo. */
function sitioDe(local: PerfilMatch['local']): Pick<ProcuraSemVaga, 'distrito' | 'lugar'> | null {
  if (local.label !== LABEL_GPS) {
    const lugar = LUGARES.find((l) => l.label === local.label)
    if (lugar) return { distrito: lugar.distrito, lugar: lugar.label }
  }
  let perto: (typeof LUGARES)[number] | undefined
  let d = Infinity
  for (const l of LUGARES) {
    const dl = distanceKm(local, l)
    if (dl < d) {
      d = dl
      perto = l
    }
  }
  return perto ? { distrito: perto.distrito } : null
}

/** O registo do perfil, ou null quando há vaga agora na zona (ou não se sabe o distrito). */
export function procuraDoPerfil(perfil: PerfilMatch, total: number, comVaga: number): ProcuraSemVaga | null {
  if (comVaga > 0) return null
  const sitio = sitioDe(perfil.local)
  if (!sitio) return null
  return {
    ...sitio,
    grau: perfil.grau,
    cuidados: [...perfil.necessidades],
    // "Ainda não sei" não é um limite de orçamento
    ...(semLimiteOrcamento(perfil.orcamentoMax) ? {} : { orcamentoMax: perfil.orcamentoMax }),
    resultados: total,
    comVaga: 0,
  }
}
