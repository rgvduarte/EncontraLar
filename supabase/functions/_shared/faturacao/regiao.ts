/**
 * Região fiscal e taxa normal de IVA dos lares (B2B), a partir do código postal da morada fiscal.
 *
 * - 9000–9499: Madeira (inclui Porto Santo, 9400), 22 %
 * - 9500–9999: Açores, 16 %
 * - resto: Continente, 23 %
 *
 * Sem código postal válido, usa-se a região da ficha (public.regiao). O lugar da prestação dos serviços B2B
 * (sede do cliente vs morada do lar) é pergunta ao contabilista (DL 347/85).
 */
import type { TaxaIva } from './dinheiro.ts'

export type RegiaoFiscal = 'continente' | 'madeira' | 'acores'

export const IVA_POR_REGIAO: Readonly<Record<RegiaoFiscal, TaxaIva>> = { continente: 23, madeira: 22, acores: 16 }

export const CODIGO_POSTAL = /^(\d{4})-(\d{3})$/

/** null se o código postal não tiver o formato 0000-000. */
export function regiaoFiscalDoCodigoPostal(cp: string | null | undefined): RegiaoFiscal | null {
  const m = CODIGO_POSTAL.exec((cp ?? '').trim())
  if (!m) return null
  const n = Number(m[1])
  if (n < 1000) return null
  if (n >= 9000 && n <= 9499) return 'madeira'
  if (n >= 9500) return 'acores'
  return 'continente'
}

/** public.regiao ('Norte', …, 'Madeira', 'Açores') → região fiscal. */
export function regiaoFiscalDaRegiao(regiao: string | null | undefined): RegiaoFiscal {
  if (regiao === 'Madeira') return 'madeira'
  if (regiao === 'Açores') return 'acores'
  return 'continente'
}

/** O código postal fiscal manda; sem ele, a região da ficha. */
export function regiaoFiscal(codigoPostal: string | null | undefined, regiao?: string | null): RegiaoFiscal {
  return regiaoFiscalDoCodigoPostal(codigoPostal) ?? regiaoFiscalDaRegiao(regiao)
}

export const ivaDaRegiao = (r: RegiaoFiscal): TaxaIva => IVA_POR_REGIAO[r]
