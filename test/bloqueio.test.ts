import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  chaveBloqueio,
  limparFalhas,
  registrarFalha,
  segundosDeBloqueio
} from '../src/auth/bloqueio'

describe('Autenticação - Bloqueio por Login e IP', () => {
  test('chaveBloqueio normaliza login e combina com IP', () => {
    assert.equal(chaveBloqueio('Admin', '192.168.0.1'), 'admin:192.168.0.1')
    assert.equal(chaveBloqueio('  recepcao  ', ' 10.0.0.1 '), 'recepcao:10.0.0.1')
  })

  test('5 falhas com o mesmo login e IP bloqueiam a chave por 60 segundos', () => {
    const agora = 1_700_000_000_000
    const chave = chaveBloqueio('usuario_teste', '127.0.0.1')
    limparFalhas(chave)

    // 4 falhas: ainda não bloqueado
    for (let i = 0; i < 4; i++) {
      registrarFalha(chave, agora)
      assert.equal(segundosDeBloqueio(chave, agora), 0)
    }

    // 5ª falha: bloqueado
    registrarFalha(chave, agora)
    const segundos = segundosDeBloqueio(chave, agora)
    assert.equal(segundos, 60)

    // Após 61 segundos: liberado
    assert.equal(segundosDeBloqueio(chave, agora + 61_000), 0)
  })

  test('bloqueio de um IP não bloqueia o mesmo login a partir de outro IP', () => {
    const agora = 1_700_000_000_000
    const chaveAtacante = chaveBloqueio('admin', '203.0.113.5')
    const chaveLegitima = chaveBloqueio('admin', '198.51.100.99')

    limparFalhas(chaveAtacante)
    limparFalhas(chaveLegitima)

    for (let i = 0; i < 5; i++) {
      registrarFalha(chaveAtacante, agora)
    }

    assert.ok(segundosDeBloqueio(chaveAtacante, agora) > 0, 'Atacante deve ser bloqueado')
    assert.equal(
      segundosDeBloqueio(chaveLegitima, agora),
      0,
      'IP legítimo não deve ser bloqueado pelo atacante'
    )
  })

  test('limparFalhas reseta o bloqueio', () => {
    const agora = 1_700_000_000_000
    const chave = chaveBloqueio('usuario_reset', '127.0.0.2')
    for (let i = 0; i < 5; i++) {
      registrarFalha(chave, agora)
    }
    assert.ok(segundosDeBloqueio(chave, agora) > 0)

    limparFalhas(chave)
    assert.equal(segundosDeBloqueio(chave, agora), 0)
  })
})
