import { describe, expect, it } from 'vitest'
import type { Lar } from '@/types'
import {
  comVoltar,
  descreverDestino,
  destinoAposEntrar,
  destinoAposRegistoProfissional,
  ehAcesso,
  intencaoDe,
  motivoDoDestino,
  precisaDeAcesso,
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

describe('Acesso Família (/acesso)', () => {
  // o que o bloqueio da ficha manda: /acesso com o plano e o caminho de volta (já codificado)
  const acesso = `/acesso?plano=acesso_90&voltar=${encodeURIComponent('/lar/lar-sao-bento?acao=pedir')}`

  it('é um voltar público: segue inteiro depois de entrar ou criar conta de família', () => {
    expect(destinoAposEntrar(acesso, 'familia')).toBe(acesso)
    expect(voltarPublico(acesso)).toBe(acesso)
    expect(voltarPublico('/acesso')).toBe('/acesso')
    expect(voltarPublico('/acesso?plano=acesso_30')).toBe('/acesso?plano=acesso_30')
  })

  it('instituições e profissionais seguem para lá sem tratamento especial (a página explica-lhes)', () => {
    expect(destinoAposEntrar(acesso, 'lar')).toBe(acesso)
    expect(destinoAposEntrar(acesso, 'profissional')).toBe(acesso)
    expect(destinoAposRegistoProfissional(acesso)).toBe(acesso)
  })

  it('a pesquisa inteira sobrevive à ida e volta entre entrar e criar conta', () => {
    for (const via of ['/entrar', '/registar'] as const) {
      const link = comVoltar(via, acesso)
      expect(link.startsWith(`${via}?voltar=`)).toBe(true)
      const recebido = new URLSearchParams(link.slice(link.indexOf('?') + 1)).get('voltar')
      expect(recebido).toBe(acesso)
      // o voltar de dentro também chega intacto à página do Acesso Família
      expect(new URLSearchParams(recebido!.split('?')[1]).get('voltar')).toBe('/lar/lar-sao-bento?acao=pedir')
      expect(new URLSearchParams(recebido!.split('?')[1]).get('plano')).toBe('acesso_90')
    }
    expect(comVoltar('/entrar', null)).toBe('/entrar')
    expect(comVoltar('/registar', '//exemplo.com')).toBe('/registar')
  })

  it('descreve a intenção, e não confunde o voltar de dentro com um pedido de vaga', () => {
    expect(ehAcesso(acesso)).toBe(true)
    expect(ehAcesso('/acesso')).toBe(true)
    expect(ehAcesso('/acessos')).toBe(false)
    expect(ehAcesso('/lar/x?voltar=/acesso')).toBe(false)
    expect(intencaoDe(acesso)).toBeNull()
    expect(motivoDoDestino(acesso, lares)).toBe('ativar o Acesso Família')
    // mal codificado (o &acao do voltar de dentro solto): continua a ser o Acesso Família
    expect(motivoDoDestino('/acesso?voltar=/lar/lar-sao-bento&acao=pedir', lares)).toBe('ativar o Acesso Família')
    expect(descreverDestino('/acesso?plano=acesso_30', lares)).toBe('a página do Acesso Família')
  })

  it('sabe que ações precisam do passe (guardar é livre)', () => {
    expect(precisaDeAcesso('/lar/lar-sao-bento?acao=pedir')).toBe(true)
    expect(precisaDeAcesso('/lar/lar-sao-bento?acao=visita')).toBe(true)
    expect(precisaDeAcesso('/pesquisa?alerta=lar-sao-bento')).toBe(true)
    expect(precisaDeAcesso('/pesquisa?guardar=lar-sao-bento')).toBe(false)
    expect(precisaDeAcesso('/lar/lar-sao-bento')).toBe(false)
    expect(precisaDeAcesso(acesso)).toBe(false)
    expect(precisaDeAcesso(null)).toBe(false)
  })
})
