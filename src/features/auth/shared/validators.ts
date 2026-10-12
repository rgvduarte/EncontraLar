import { getDB } from '@/lib/store'

/** Minúsculas e sem acentos — para comparar texto livre ("evora" = "Évora"). */
export const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const emailValido = (v: string) => EMAIL_RE.test(v.trim())

export const emailJaRegistado = (v: string) => {
  const e = v.trim().toLowerCase()
  return getDB().users.some((u) => u.email.toLowerCase() === e)
}

export const MSG_EMAIL_EXISTE = 'Já existe uma conta com este email.'

export function validarNome(v: string, quem = 'o seu nome'): string | undefined {
  const t = v.trim()
  if (!t) return `Indique ${quem}.`
  if (t.length < 2) return `${quem.charAt(0).toUpperCase()}${quem.slice(1)} parece incompleto.`
  return undefined
}

export function validarEmail(v: string, { novo = false } = {}): string | undefined {
  if (!v.trim()) return 'Indique o seu email.'
  if (!emailValido(v)) return 'Escreva o email completo, por exemplo nome@exemplo.pt.'
  if (novo && emailJaRegistado(v)) return MSG_EMAIL_EXISTE
  return undefined
}

/** Remove espaços, pontos, hífenes e o indicativo de Portugal. */
export function digitosTelefone(v: string): string {
  let d = v.replace(/[\s.()-]/g, '')
  if (d.startsWith('+351')) d = d.slice(4)
  else if (d.startsWith('00351')) d = d.slice(5)
  return d
}

/** Telemóvel português (opcional): 9 dígitos a começar por 9. */
export function validarTelemovel(v: string): string | undefined {
  if (!v.trim()) return undefined
  const d = digitosTelefone(v)
  if (!/^\d{9}$/.test(d) || !d.startsWith('9')) return 'O telemóvel deve ter 9 dígitos e começar por 9, por exemplo 912 345 678.'
  return undefined
}

/** Telefone fixo ou móvel português (obrigatório): 9 dígitos a começar por 2 ou 9. */
export function validarTelefone(v: string): string | undefined {
  if (!v.trim()) return 'Indique um telefone para as famílias e para a nossa equipa.'
  const d = digitosTelefone(v)
  if (!/^[29]\d{8}$/.test(d)) return 'O telefone deve ter 9 dígitos e começar por 2 ou 9, por exemplo 220 000 000.'
  return undefined
}

/** "912345678" → "912 345 678" */
export function formatarTelefone(v: string): string {
  const d = digitosTelefone(v)
  return /^\d{9}$/.test(d) ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : v.trim()
}

export const PASSWORD_MIN = 8

export function validarPalavraPasseNova(v: string): string | undefined {
  if (!v) return 'Escolha uma palavra-passe.'
  if (v.length < PASSWORD_MIN) return `A palavra-passe precisa de pelo menos ${PASSWORD_MIN} caracteres (tem ${v.length}).`
  return undefined
}

/** Número inteiro dentro de um intervalo. */
export function validarInteiro(v: string, { min, max, vazio, foraIntervalo }: { min: number; max: number; vazio: string; foraIntervalo: string }) {
  const t = v.trim().replace(/\s/g, '')
  if (!t) return vazio
  if (!/^\d+$/.test(t)) return 'Use apenas algarismos, sem pontos nem vírgulas.'
  const n = Number(t)
  if (n < min || n > max) return foraIntervalo
  return undefined
}
