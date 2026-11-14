import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { podeExcluirAluno } from '../src/servicos/alunos'

describe('Serviço de Alunos - Exclusão', () => {
  test('podeExcluirAluno retorna true quando não há matrículas (0)', () => {
    assert.equal(podeExcluirAluno(0), true)
  })

  test('podeExcluirAluno retorna false quando há 1 matrícula', () => {
    assert.equal(podeExcluirAluno(1), false)
  })

  test('podeExcluirAluno retorna false quando há múltiplas matrículas (5)', () => {
    assert.equal(podeExcluirAluno(5), false)
  })
})
