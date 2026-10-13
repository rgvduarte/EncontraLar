/**
 * NIF português: 9 dígitos, prefixo válido e dígito de controlo mod 11.
 *
 * - B2B (lares): 999999990 (o NIF genérico de "consumidor final") é recusado — a fatura é a uma empresa.
 * - B2C (famílias): o NIF é opcional; 999999990 é aceite e quer dizer consumidor final (fatura sem NIF).
 *
 * Mesma regra que o domínio public.nif do desenho v1 (plano-faturacao.md, A1).
 */

export const NIF_CONSUMIDOR_FINAL = '999999990'

/** Prefixos atribuídos: 1–3 pessoas singulares, 45 não residentes, 5 coletivas, 6 públicas, 8 ENI, 7x e 9x especiais. */
const PREFIXO_VALIDO = /^([123568][0-9]|45|7[0124579]|9[0189])[0-9]{7}$/

/** Tira espaços, pontos, hífenes e o prefixo de país "PT". */
export function normalizarNIF(v: string): string {
  return v.trim().toUpperCase().replace(/^PT/, '').replace(/[\s.\-]/g, '')
}

/** Só o dígito de controlo (mod 11), sem olhar ao prefixo. */
export function digitoControloValido(nif: string): boolean {
  if (!/^\d{9}$/.test(nif)) return false
  let soma = 0
  for (let i = 0; i < 8; i++) soma += Number(nif[i]) * (9 - i)
  const resto = soma % 11
  const controlo = resto < 2 ? 0 : 11 - resto
  return controlo === Number(nif[8])
}

export type ContextoNIF = 'b2b' | 'b2c'

export type ResultadoNIF =
  | { ok: true; nif: string; consumidorFinal: boolean }
  | { ok: false; erro: string }

export function validarNIF(valor: string, contexto: ContextoNIF): ResultadoNIF {
  const nif = normalizarNIF(valor)
  if (!/^\d{9}$/.test(nif)) return { ok: false, erro: 'O NIF tem 9 algarismos.' }
  if (!PREFIXO_VALIDO.test(nif) || !digitoControloValido(nif)) return { ok: false, erro: 'Este NIF não é válido. Confirme os algarismos.' }
  if (nif === NIF_CONSUMIDOR_FINAL) {
    if (contexto === 'b2b') return { ok: false, erro: 'Indique o NIF da entidade: o NIF de consumidor final não serve para faturas a empresas.' }
    return { ok: true, nif, consumidorFinal: true }
  }
  return { ok: true, nif, consumidorFinal: false }
}

/** Mensagem de erro (PT-PT) ou null se for válido. */
export function erroNIF(valor: string, contexto: ContextoNIF): string | null {
  const r = validarNIF(valor, contexto)
  return r.ok ? null : r.erro
}
