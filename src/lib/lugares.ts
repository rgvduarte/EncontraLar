/**
 * Preposições com nomes de terras e distritos, em português de Portugal:
 * "no Porto", "do Porto", "em Lisboa", "de Braga", "na Maia", "nas Caldas da Rainha".
 * A maioria das terras não leva artigo; as que levam estão em ARTIGO_TERRA.
 */
import type { Distrito } from '@/types'

type Artigo = 'o' | 'a' | 'os' | 'as'

/** Artigo usado com o nome da terra (a maioria não leva artigo). */
export const ARTIGO_TERRA: Record<string, Artigo> = {
  // masculinos
  Porto: 'o',
  Barreiro: 'o',
  Montijo: 'o',
  Seixal: 'o',
  Estoril: 'o',
  Funchal: 'o',
  Lumiar: 'o',
  Areeiro: 'o',
  Bonfim: 'o',
  'Peso da Régua': 'o',
  'Parque das Nações': 'o',
  // femininos
  Maia: 'a',
  Amora: 'a',
  'Póvoa de Varzim': 'a',
  'Figueira da Foz': 'a',
  Lousã: 'a',
  'Marinha Grande': 'a',
  Covilhã: 'a',
  Guarda: 'a',
  Amadora: 'a',
  'Ribeira Grande': 'a',
  Boavista: 'a',
  'Foz do Douro': 'a',
  Estrela: 'a',
  Madeira: 'a',
  // plurais
  Açores: 'os',
  'Caldas da Rainha': 'as',
}

const DE: Record<Artigo, string> = { o: 'do', a: 'da', os: 'dos', as: 'das' }
const EM: Record<Artigo, string> = { o: 'no', a: 'na', os: 'nos', as: 'nas' }

/** "do Porto", "de Braga", "da Maia" */
export function deTerra(nome: string): string {
  const art = ARTIGO_TERRA[nome]
  return art ? `${DE[art]} ${nome}` : `de ${nome}`
}

/** "no Porto", "em Braga", "na Maia" */
export function emTerra(nome: string): string {
  const art = ARTIGO_TERRA[nome]
  return art ? `${EM[art]} ${nome}` : `em ${nome}`
}

export const LABEL_GPS = 'A sua localização'

/** "do Porto", "de Alvalade", "da sua localização" — para "a 5 km do Porto". Aceita "Cidade — Zona". */
export function deLocal(label: string): string {
  if (label === LABEL_GPS) return 'da sua localização'
  const [cidade, zona] = label.split(' — ')
  return deTerra(zona ?? cidade ?? label)
}

/** "perto do Porto", "perto de Alvalade, em Lisboa", "perto da sua localização" */
export function pertoDe(label: string): string {
  if (label === LABEL_GPS) return 'perto da sua localização'
  const [cidade, zona] = label.split(' — ')
  if (zona && cidade) return `perto ${deTerra(zona)}, ${emTerra(cidade)}`
  return `perto ${deTerra(label)}`
}

// ————————————————————————————————————————— distritos e regiões autónomas

export const eRegiaoAutonoma = (d: Distrito) => d === 'Madeira' || d === 'Açores'

/** "do Porto", "da Guarda", "de Braga", "da Madeira", "dos Açores" */
export const deDistrito = (d: Distrito) => deTerra(d)

/** "distrito do Porto", "distrito de Braga", "Região Autónoma da Madeira" (minúscula a meio da frase). */
export const distritoDe = (d: Distrito) => (eRegiaoAutonoma(d) ? `Região Autónoma ${deTerra(d)}` : `distrito ${deTerra(d)}`)

/** "Distrito do Porto", "Região Autónoma dos Açores" (rótulo / início de frase). */
export const nomeDistrito = (d: Distrito) => (eRegiaoAutonoma(d) ? `Região Autónoma ${deTerra(d)}` : `Distrito ${deTerra(d)}`)

/** "no distrito do Porto", "na Região Autónoma da Madeira" */
export const noDistrito = (d: Distrito) => (eRegiaoAutonoma(d) ? `na ${distritoDe(d)}` : `no ${distritoDe(d)}`)
