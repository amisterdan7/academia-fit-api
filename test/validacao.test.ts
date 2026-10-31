import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { alunoSchema, matriculaLegadaSchema, planoSchema, validar } from '../src/validacao'

describe('Validação - Limites de tamanho', () => {
  test('plano: nome com até 50 caracteres é aceito', () => {
    const nomeValido = 'A'.repeat(50)
    const dados = validar(planoSchema, {
      nome: nomeValido,
      preco: 100,
      duracao_meses: 1
    })
    assert.equal(dados.nome, nomeValido)
  })

  test('plano: nome com mais de 50 caracteres é rejeitado com mensagem em português', () => {
    const nomeLongo = 'A'.repeat(51)
    assert.throws(
      () =>
        validar(planoSchema, {
          nome: nomeLongo,
          preco: 100,
          duracao_meses: 1
        }),
      (erro: any) => {
        assert.equal(erro.codigo, 'VALIDACAO')
        assert.match(erro.message, /máximo 50 caracteres/i)
        return true
      }
    )
  })

  test('aluno: telefone com até 20 caracteres (com máscara) é aceito', () => {
    const telefoneValido = '+55 (84) 99999-0000' // 19 caracteres
    assert.ok(telefoneValido.length <= 20)
    const dados = validar(alunoSchema, {
      nome: 'Aluno Teste Valido',
      data_nascimento: '1995-05-10',
      telefone: `  ${telefoneValido}  ` // testa o trim
    })
    assert.equal(dados.telefone, telefoneValido)
  })

  test('aluno: telefone com mais de 20 caracteres após trim é rejeitado', () => {
    const telefoneLongo = '1'.repeat(21)
    assert.throws(
      () =>
        validar(alunoSchema, {
          nome: 'Aluno Teste Invalido',
          data_nascimento: '1995-05-10',
          telefone: telefoneLongo
        }),
      (erro: any) => {
        assert.equal(erro.codigo, 'VALIDACAO')
        assert.match(erro.message, /máximo 20 caracteres/i)
        return true
      }
    )
  })

  test('matricula legada: nome do plano acima de 50 caracteres é rejeitado', () => {
    assert.throws(
      () =>
        validar(matriculaLegadaSchema, {
          nome: 'Aluno Teste',
          data_nascimento: '1995-05-10',
          nome_plano: 'P'.repeat(51)
        }),
      (erro: any) => {
        assert.equal(erro.codigo, 'VALIDACAO')
        assert.match(erro.message, /máximo 50 caracteres/i)
        return true
      }
    )
  })
})
