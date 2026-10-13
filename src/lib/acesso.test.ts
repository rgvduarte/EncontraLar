import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_FAMILIA_EMAIL, DEMO_LAR_EMAIL, DEMO_PASSWORD, DEMO_PRO_EMAIL } from '@/data/seed'
import { acessoAtivo, diasRestantes, faixaPreco, novoAte, planoFamilia, PLANOS_FAMILIA, precoTexto, temAcessoCompleto } from './acesso'
import { comprarAcessoDemo, getCurrentUser, login, logout, register, resetDemo } from './store'

const DIA = 86_400_000
const agora = Date.parse('2026-10-13T10:00:00Z')

describe('Acesso Família — regras', () => {
  it('preços com IVA incluído e formato português', () => {
    expect(PLANOS_FAMILIA.map((p) => p.precoCentimos)).toEqual([1490, 2990])
    expect(precoTexto(2990)).toBe('29,90 €')
  })

  it('o passe termina na data indicada', () => {
    const a = { plano: 'acesso_30' as const, compradoEm: '', ate: new Date(agora + DIA).toISOString(), origem: 'compra' as const }
    expect(acessoAtivo(a, agora)).toBe(true)
    expect(acessoAtivo(a, agora + 2 * DIA)).toBe(false)
    expect(diasRestantes(a, agora)).toBe(1)
  })

  it('comprar com um passe em vigor soma os dias (não se perdem dias pagos)', () => {
    const atual = { plano: 'acesso_30' as const, compradoEm: '', ate: new Date(agora + 10 * DIA).toISOString(), origem: 'compra' as const }
    expect(Date.parse(novoAte(atual, planoFamilia('acesso_90'), agora))).toBe(agora + 100 * DIA)
    expect(Date.parse(novoAte(undefined, planoFamilia('acesso_30'), agora))).toBe(agora + 30 * DIA)
  })

  it('quem vê a camada completa: famílias com passe e profissionais; visitantes e instituições não', () => {
    const ativo = { plano: 'acesso_90' as const, compradoEm: '', ate: new Date(agora + DIA).toISOString(), origem: 'compra' as const }
    expect(temAcessoCompleto(null, agora)).toBe(false)
    expect(temAcessoCompleto({ role: 'familia' }, agora)).toBe(false)
    expect(temAcessoCompleto({ role: 'familia', acesso: ativo }, agora)).toBe(true)
    expect(temAcessoCompleto({ role: 'profissional' }, agora)).toBe(true)
    expect(temAcessoCompleto({ role: 'lar' }, agora)).toBe(false)
  })

  it('faixa de preço genérica, sem o valor exato', () => {
    expect(faixaPreco({ natureza: 'privado', mensalidadeMin: 1550 })).toBe('1.000 € a 2.000 €/mês')
    expect(faixaPreco({ natureza: 'ipss', mensalidadeMin: 350 })).toBe('Conforme os rendimentos')
  })
})

describe('Acesso Família — compra simulada (store)', () => {
  beforeEach(() => {
    logout()
    resetDemo()
  })

  it('a família de demonstração já tem um passe ativo', () => {
    login(DEMO_FAMILIA_EMAIL, DEMO_PASSWORD)
    expect(temAcessoCompleto(getCurrentUser())).toBe(true)
  })

  it('uma conta nova começa na versão grátis e fica completa depois de comprar', () => {
    const r = register({ role: 'familia', nome: 'Rita Teste', email: 'rita.teste@exemplo.pt', password: 'palavrapasse1' })
    expect(r.ok).toBe(true)
    expect(temAcessoCompleto(getCurrentUser())).toBe(false)
    const c = comprarAcessoDemo('acesso_30', 'mbway')
    expect(c.ok).toBe(true)
    expect(temAcessoCompleto(getCurrentUser())).toBe(true)
    expect(getCurrentUser()?.acesso?.valorCentimos).toBe(1490)
  })

  it('só contas de família compram o passe', () => {
    expect(comprarAcessoDemo('acesso_30', 'cartao').ok).toBe(false)
    login(DEMO_LAR_EMAIL, DEMO_PASSWORD)
    expect(comprarAcessoDemo('acesso_30', 'cartao').ok).toBe(false)
    login(DEMO_PRO_EMAIL, DEMO_PASSWORD)
    expect(comprarAcessoDemo('acesso_30', 'cartao').ok).toBe(false)
  })
})
