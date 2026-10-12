import type { Rules, useForm } from '../shared/useForm'
import {
  validarEmail,
  validarInteiro,
  validarNome,
  validarPalavraPasseNova,
  validarTelefone,
} from '../shared/validators'
import { lugarCanonico } from './LugarCombobox'

export type InstValues = {
  // responsável
  nome: string
  cargo: string
  email: string
  telefone: string
  password: string
  // instituição
  instNome: string
  tipo: string
  natureza: string
  lugar: string
  morada: string
  capacidade: string
  licenca: string
  precoDesde: string
  // confirmação (inclui a declaração de que representa a instituição)
  termos: boolean
  privacidade: boolean
}

export type InstForm = ReturnType<typeof useForm<InstValues>>

export const INST_INITIAL: InstValues = {
  nome: '',
  cargo: '',
  email: '',
  telefone: '',
  password: '',
  instNome: '',
  tipo: 'erpi',
  natureza: '',
  lugar: '',
  morada: '',
  capacidade: '',
  licenca: '',
  precoDesde: '',
  termos: false,
  privacidade: false,
}

export const INST_ORDER: (keyof InstValues)[] = [
  'nome', 'cargo', 'email', 'telefone', 'password',
  'instNome', 'tipo', 'natureza', 'lugar', 'morada', 'capacidade', 'licenca', 'precoDesde',
  'termos', 'privacidade',
]

export const INST_RULES: Rules<InstValues> = {
  nome: (v) => validarNome(v),
  cargo: (v) => (!v.trim() ? 'Indique o seu cargo, por exemplo diretora técnica.' : undefined),
  email: (v) => validarEmail(v, { novo: true }),
  telefone: (v) => validarTelefone(v),
  password: (v) => validarPalavraPasseNova(v),
  instNome: (v) => validarNome(v, 'o nome da instituição'),
  tipo: (v) => (!v ? 'Escolha o tipo de instituição.' : undefined),
  natureza: (v) => (!v ? 'Escolha a natureza: IPSS, Misericórdia ou privada.' : undefined),
  lugar: (v) =>
    !v.trim()
      ? 'Indique a localidade da instituição.'
      : !lugarCanonico(v)
        ? 'Escolha a localidade numa das sugestões da lista.'
        : undefined,
  morada: (v) => (v.trim().length < 5 ? 'Indique a morada, com rua e número.' : undefined),
  capacidade: (v) =>
    validarInteiro(v, {
      min: 1,
      max: 400,
      vazio: 'Indique o número de lugares.',
      foraIntervalo: 'A capacidade deve estar entre 1 e 400 lugares.',
    }),
  licenca: (v) =>
    !v.trim()
      ? 'Indique o número do alvará ou da licença de funcionamento.'
      : !/\d/.test(v)
        ? 'O número da licença deve ter algarismos, por exemplo 217/2009.'
        : undefined,
  precoDesde: (v) =>
    validarInteiro(v, {
      min: 100,
      max: 10000,
      vazio: 'Indique a mensalidade mais baixa.',
      foraIntervalo: 'A mensalidade deve estar entre 100 € e 10 000 €.',
    }),
  termos: (v) => (v ? undefined : 'Confirme que representa a instituição e aceita os termos.'),
  privacidade: (v) => (v ? undefined : 'Confirme que leu a política de privacidade.'),
}
