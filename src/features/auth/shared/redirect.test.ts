import { describe, expect, it } from 'vitest'
import type { Lar } from '@/types'
import {
  descreverDestino,
  destinoAposEntrar,
  destinoAposRegistoProfissional,
  intencaoDe,
  motivoDoDestino,
  roleDoCaminho,
  voltarPublico,
} from './redirect'

const lares = [
  { id: 'lar-jardins-do-douro', nome: 'Casa de Repouso Jardins do Douro' },
  { id: 'lar-sao-bento', nome: 'Lar São Bento' },
  { id: 'lar-outro', nome: 'Mansarda Feliz' },
] as Lar[]

describe('voltar com intenção', () => {
  it('segue intacto depois de entrar e de criar conta', () => {
    const v = '/lar/lar-jardins-do-douro?acao=pedir'
    expect(destinoAposEntrar(v, 'familia')).toBe(v)
    expect(voltarPublico(v)).toBe(v)
    expect(voltarPublico('/pesquisa?lugar=Faro&guardar=lar-sao-bento')).toBe('/pesquisa?lugar=Faro&guardar=lar-sao-bento')
  })

  it('não leva uma família para a área das instituições', () => {
    expect(destinoAposEntrar('/gestao/vagas', 'familia')).toBe('/familia')
    expect(voltarPublico('/familia/pedidos')).toBeNull()
  })

  it('lê a intenção', () => {
    expect(intencaoDe('/lar/lar-sao-bento?acao=visita')).toEqual({ acao: 'visita', larId: 'lar-sao-bento' })
    expect(intencaoDe('/lar/lar-sao-bento?pedir=vaga')).toEqual({ acao: 'pedir', larId: 'lar-sao-bento' })
    expect(intencaoDe('/pesquisa?lugar=Faro&guardar=lar-outro')).toEqual({ acao: 'guardar', larId: 'lar-outro' })
    expect(intencaoDe('/lar/lar-sao-bento')).toBeNull()
  })

  it('descreve o motivo com o artigo certo', () => {
    expect(motivoDoDestino('/lar/lar-jardins-do-douro?acao=pedir', lares)).toBe('pedir vaga na Casa de Repouso Jardins do Douro')
    expect(motivoDoDestino('/lar/lar-sao-bento?acao=visita', lares)).toBe('marcar uma visita no Lar São Bento')
    expect(motivoDoDestino('/lar/lar-sao-bento?acao=alerta', lares)).toBe('receber alertas de vaga do Lar São Bento')
    expect(motivoDoDestino('/pesquisa?guardar=lar-outro', lares)).toBe('guardar Mansarda Feliz')
    expect(motivoDoDestino('/lar/lar-jardins-do-douro', lares)).toBe('abrir a ficha da Casa de Repouso Jardins do Douro')
    expect(motivoDoDestino('/familia/pedidos', lares)).toBe('abrir os seus pedidos de vaga')
    expect(descreverDestino('/', lares)).toBeNull()
  })
})

describe('área dos casos (profissional)', () => {
  it('só um profissional segue para um caso', () => {
    expect(roleDoCaminho('/casos/caso-1')).toBe('profissional')
    expect(destinoAposEntrar('/casos/caso-1', 'profissional')).toBe('/casos/caso-1')
    expect(destinoAposEntrar('/casos/novo?lar=lar-sao-bento', 'profissional')).toBe('/casos/novo?lar=lar-sao-bento')
    expect(destinoAposEntrar('/casos/caso-1', 'familia')).toBe('/familia')
    expect(destinoAposEntrar('/casos', 'lar')).toBe('/gestao')
    expect(voltarPublico('/casos/caso-1')).toBeNull()
  })

  it('leva o profissional aos casos, por omissão', () => {
    expect(destinoAposEntrar(null, 'profissional')).toBe('/casos')
    expect(destinoAposEntrar('/familia/pedidos', 'profissional')).toBe('/casos')
    expect(destinoAposEntrar('/gestao', 'profissional')).toBe('/casos')
  })

  it('depois do registo profissional', () => {
    expect(destinoAposRegistoProfissional(null)).toBe('/casos')
    expect(destinoAposRegistoProfissional('/')).toBe('/casos')
    expect(destinoAposRegistoProfissional('/profissionais')).toBe('/casos')
    expect(destinoAposRegistoProfissional('/registar?tipo=profissional')).toBe('/casos')
    expect(destinoAposRegistoProfissional('/gestao/pedidos')).toBe('/casos')
    expect(destinoAposRegistoProfissional('//exemplo.com')).toBe('/casos')
    expect(destinoAposRegistoProfissional('/casos/caso-1')).toBe('/casos/caso-1')
    expect(destinoAposRegistoProfissional('/lar/lar-sao-bento?acao=pedir')).toBe('/lar/lar-sao-bento?acao=pedir')
  })

  it('descreve o destino', () => {
    expect(motivoDoDestino('/casos/caso-1', lares)).toBe('abrir a ficha do caso')
    expect(motivoDoDestino('/casos/novo?lar=lar-sao-bento', lares)).toBe('abrir um caso novo')
    expect(motivoDoDestino('/casos', lares)).toBe('abrir os seus casos')
  })
})
