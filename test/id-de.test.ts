import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { ErroHttp } from '../src/erros'
import { idDe } from '../src/validacao'

function ehErroValidacao(erro: unknown, mensagem?: string): boolean {
  assert.ok(erro instanceof ErroHttp)
  assert.equal(erro.codigo, 'VALIDACAO')
  if (mensagem !== undefined) assert.equal(erro.message, mensagem)
  return true
}

describe('Validação - idDe', () => {
  test('aceita inteiros decimais positivos', () => {
    assert.equal(idDe({ id: '1' }), 1)
    assert.equal(idDe({ id: '42' }), 42)
    assert.equal(idDe({ id: '99999' }), 99999)
  })

  test('rejeita formato de notação científica "1e3"', () => {
    assert.throws(() => idDe({ id: '1e3' }), (erro: unknown) =>
      ehErroValidacao(erro, 'Identificador inválido.')
    )
  })

  test('rejeita formato hexadecimal "0x10"', () => {
    assert.throws(() => idDe({ id: '0x10' }), (erro: unknown) =>
      ehErroValidacao(erro, 'Identificador inválido.')
    )
  })

  test('rejeita zero', () => {
    assert.throws(() => idDe({ id: '0' }), (erro: unknown) => ehErroValidacao(erro))
  })

  test('rejeita números negativos', () => {
    assert.throws(() => idDe({ id: '-5' }), (erro: unknown) => ehErroValidacao(erro))
  })

  test('rejeita números com ponto decimal', () => {
    assert.throws(() => idDe({ id: '1.5' }), (erro: unknown) => ehErroValidacao(erro))
  })

  test('rejeita strings alfanuméricas ou vazias', () => {
    assert.throws(() => idDe({ id: 'abc' }), (erro: unknown) => ehErroValidacao(erro))
    assert.throws(() => idDe({ id: '' }), (erro: unknown) => ehErroValidacao(erro))
    assert.throws(() => idDe({ id: ' 1 ' }), (erro: unknown) => ehErroValidacao(erro))
  })

  test('rejeita parâmetro ausente ou array', () => {
    assert.throws(() => idDe({}), (erro: unknown) => ehErroValidacao(erro))
    assert.throws(() => idDe({ id: ['1'] }), (erro: unknown) => ehErroValidacao(erro))
  })
})
