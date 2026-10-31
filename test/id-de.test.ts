import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { idDe } from '../src/validacao'

describe('Validação - idDe', () => {
  test('aceita inteiros decimais positivos', () => {
    assert.equal(idDe({ id: '1' }), 1)
    assert.equal(idDe({ id: '42' }), 42)
    assert.equal(idDe({ id: '99999' }), 99999)
  })

  test('rejeita formato de notação científica "1e3"', () => {
    assert.throws(() => idDe({ id: '1e3' }), (erro: any) => {
      assert.equal(erro.codigo, 'VALIDACAO')
      assert.equal(erro.message, 'Identificador inválido.')
      return true
    })
  })

  test('rejeita formato hexadecimal "0x10"', () => {
    assert.throws(() => idDe({ id: '0x10' }), (erro: any) => {
      assert.equal(erro.codigo, 'VALIDACAO')
      assert.equal(erro.message, 'Identificador inválido.')
      return true
    })
  })

  test('rejeita zero', () => {
    assert.throws(() => idDe({ id: '0' }), (erro: any) => {
      assert.equal(erro.codigo, 'VALIDACAO')
      return true
    })
  })

  test('rejeita números negativos', () => {
    assert.throws(() => idDe({ id: '-5' }), (erro: any) => {
      assert.equal(erro.codigo, 'VALIDACAO')
      return true
    })
  })

  test('rejeita números com ponto decimal', () => {
    assert.throws(() => idDe({ id: '1.5' }), (erro: any) => {
      assert.equal(erro.codigo, 'VALIDACAO')
      return true
    })
  })

  test('rejeita strings alfanuméricas ou vazias', () => {
    assert.throws(() => idDe({ id: 'abc' }), (erro: any) => erro.codigo === 'VALIDACAO')
    assert.throws(() => idDe({ id: '' }), (erro: any) => erro.codigo === 'VALIDACAO')
    assert.throws(() => idDe({ id: ' 1 ' }), (erro: any) => erro.codigo === 'VALIDACAO')
  })

  test('rejeita parâmetro ausente ou array', () => {
    assert.throws(() => idDe({}), (erro: any) => erro.codigo === 'VALIDACAO')
    assert.throws(() => idDe({ id: ['1'] }), (erro: any) => erro.codigo === 'VALIDACAO')
  })
})
