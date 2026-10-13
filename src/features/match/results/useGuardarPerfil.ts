/**
 * Guardar o perfil do questionário na conta da família — partilhado pelo painel "Guardar este perfil"
 * e pela barra de ação fixa dos resultados (que guarda num toque quando não falta nada).
 */
import type { PerfilIdoso, User } from '@/types'
import { toast } from '@/components/ui/Toast'
import { savePerfil, useAcesso, usePerfis, type PerfilInput } from '@/lib/store'
import { paraPerfilInput, type Rascunho } from '../model'
import { pessoa } from '../language'
import { escreverSessao, KEY_PERFIL_RASCUNHO } from '../useMatchSession'

const CAMPOS = [
  'nome',
  'idade',
  'relacao',
  'genero',
  'grau',
  'necessidades',
  'preferencias',
  'quarto',
  'local',
  'raioKm',
  'orcamentoMax',
  'urgencia',
  'precisaAcordoSS',
] as const satisfies readonly (keyof PerfilInput & keyof PerfilIdoso)[]

const iguais = (a: PerfilInput, b: PerfilIdoso) =>
  CAMPOS.every((k) => JSON.stringify(a[k] ?? null) === JSON.stringify(b[k] ?? null))

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome

export function useGuardarPerfil(r: Rascunho, user: User | null, onGuardado: (id: string) => void) {
  const p = pessoa(r)
  const perfis = usePerfis()
  const { completo } = useAcesso()
  /** sem nome e não é para o próprio: é preciso perguntar antes de guardar */
  const precisaNome = !r.nome.trim() && !p.proprio
  const existente = r.id ? perfis.find((x) => x.id === r.id) : undefined
  /** o nome a usar quando ninguém o escreveu (perfil do próprio utilizador) */
  const nomePorOmissao = p.proprio && !r.nome.trim() && user ? user.nome : r.nome
  const inputBase = paraPerfilInput(r, nomePorOmissao)
  // perfil guardado e nada mudou: não há nada para guardar
  const semAlteracoes = Boolean(existente && inputBase && iguais(inputBase, existente))

  const guardar = (nome: string): PerfilIdoso | null => {
    const input = paraPerfilInput(r, nome)
    if (!input) return null
    const perfil = savePerfil(input)
    if (!perfil) {
      toast.error('Não foi possível guardar', 'Inicie sessão novamente e tente outra vez.')
      return null
    }
    escreverSessao(KEY_PERFIL_RASCUNHO, null)
    onGuardado(perfil.id)
    // os avisos de vaga são do Acesso Família: sem passe, não se prometem
    toast.success(r.id ? 'Alterações guardadas' : `Perfil de ${perfil.nome} guardado`, completo ? 'Avisamos quando abrir vaga.' : 'Fica no seu painel.')
    return perfil
  }

  return { p, precisaNome, existente, nomePorOmissao, semAlteracoes, guardar }
}
