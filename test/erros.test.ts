import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { converterErro } from '../src/middleware/erros'

describe('Middleware de Erros - Mapeamento de Códigos PostgreSQL', () => {
  test('erro 22001 (valor longo demais) é convertido em 400 VALIDACAO', () => {
    const erroPg22001 = Object.assign(new Error('value too long for type character varying(50)'), {
      code: '22001'
    })

    const { status, corpo } = converterErro(erroPg22001)

    assert.equal(status, 400)
    assert.equal(corpo.error.code, 'VALIDACAO')
    assert.match(corpo.error.message, /limite de caracteres/i)
  })

  test('erro 23505 (unique_violation) é convertido em 409 CONFLITO', () => {
    const erroPg23505 = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505'
    })
    const { status, corpo } = converterErro(erroPg23505)
    assert.equal(status, 409)
    assert.equal(corpo.error.code, 'CONFLITO')
  })

  test('erro 23502 (not_null_violation) é convertido em 400 VALIDACAO', () => {
    const erroPg23502 = Object.assign(new Error('null value in column violates not-null constraint'), {
      code: '23502'
    })
    const { status, corpo } = converterErro(erroPg23502)
    assert.equal(status, 400)
    assert.equal(corpo.error.code, 'VALIDACAO')
  })
})
