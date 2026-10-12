import { deLugar } from '@/lib/format'

/** "distrito de Braga", "distrito do Porto", "distrito da Guarda"; nas ilhas, "Região Autónoma da Madeira/dos Açores". */
export function distritoTexto(distrito: string): string {
  if (distrito === 'Madeira') return 'Região Autónoma da Madeira'
  if (distrito === 'Açores') return 'Região Autónoma dos Açores'
  return `distrito ${deLugar(distrito)}`
}
