import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { exigirPermissaoCriacaoAluno } from '../src/auth/permissoes'
import { ErroHttp } from '../src/erros'
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
      (erro: unknown) => {
        assert.ok(erro instanceof ErroHttp)
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
      (erro: unknown) => {
        assert.ok(erro instanceof ErroHttp)
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
      (erro: unknown) => {
        assert.ok(erro instanceof ErroHttp)
        assert.equal(erro.codigo, 'VALIDACAO')
        assert.match(erro.message, /máximo 50 caracteres/i)
        return true
      }
    )
  })
})

describe('Validação - Cadastro de aluno com matrícula opcional', () => {
  test('aluno sem id_plano e sem data_inicio normaliza ambos como null', () => {
    const dados = validar(alunoSchema, {
      nome: 'Maria Silva',
      data_nascimento: '1998-03-20'
    })
    assert.equal(dados.id_plano, null)
    assert.equal(dados.data_inicio, null)
  })

  test('aluno com id_plano válido e sem data_inicio é aceito', () => {
    const dados = validar(alunoSchema, {
      nome: 'Maria Silva',
      data_nascimento: '1998-03-20',
      id_plano: 2
    })
    assert.equal(dados.id_plano, 2)
    assert.equal(dados.data_inicio, null)
  })

  test('aluno com id_plano e data_inicio válidos é aceito', () => {
    const dados = validar(alunoSchema, {
      nome: 'Maria Silva',
      data_nascimento: '1998-03-20',
      id_plano: 3,
      data_inicio: '2026-02-01'
    })
    assert.equal(dados.id_plano, 3)
    assert.equal(dados.data_inicio, '2026-02-01')
  })

  test('data_inicio sem id_plano é rejeitada com 400 VALIDACAO em português', () => {
    assert.throws(
      () =>
        validar(alunoSchema, {
          nome: 'Maria Silva',
          data_nascimento: '1998-03-20',
          data_inicio: '2026-02-01'
        }),
      (erro: unknown) => {
        assert.ok(erro instanceof ErroHttp)
        assert.equal(erro.status, 400)
        assert.equal(erro.codigo, 'VALIDACAO')
        assert.match(erro.message, /data de início só pode ser informada junto com o plano/i)
        return true
      }
    )
  })

  test('id_plano inválido (<= 0 ou não inteiro) é rejeitado com 400 VALIDACAO', () => {
    for (const idInvalido of [0, -1, 1.5, 'abc']) {
      assert.throws(
        () =>
          validar(alunoSchema, {
            nome: 'Maria Silva',
            data_nascimento: '1998-03-20',
            id_plano: idInvalido
          }),
        (erro: unknown) => {
        assert.ok(erro instanceof ErroHttp)
          assert.equal(erro.status, 400)
          assert.equal(erro.codigo, 'VALIDACAO')
          return true
        }
      )
    }
  })
})

describe('Permissão - Criação de aluno com e sem matrícula', () => {
  test('admin e recepcao podem criar aluno sem e com plano', () => {
    assert.doesNotThrow(() => exigirPermissaoCriacaoAluno('admin', false))
    assert.doesNotThrow(() => exigirPermissaoCriacaoAluno('admin', true))
    assert.doesNotThrow(() => exigirPermissaoCriacaoAluno('recepcao', false))
    assert.doesNotThrow(() => exigirPermissaoCriacaoAluno('recepcao', true))
  })

  test('com id_plano exige a permissão matriculas:criar (403 SEM_PERMISSAO se faltar)', () => {
    const soAlunosCriar = (_perfil: 'admin' | 'recepcao', acao: string) => acao === 'alunos:criar'

    assert.doesNotThrow(() => exigirPermissaoCriacaoAluno('recepcao', false, soAlunosCriar))

    assert.throws(
      () => exigirPermissaoCriacaoAluno('recepcao', true, soAlunosCriar),
      (erro: unknown) => {
        assert.ok(erro instanceof ErroHttp)
        assert.equal(erro.status, 403)
        assert.equal(erro.codigo, 'SEM_PERMISSAO')
        return true
      }
    )
  })

  test('sem alunos:criar rejeita com 403 SEM_PERMISSAO mesmo sem plano', () => {
    const semPermissoes = () => false
    assert.throws(
      () => exigirPermissaoCriacaoAluno('recepcao', false, semPermissoes),
      (erro: unknown) => {
        assert.ok(erro instanceof ErroHttp)
        assert.equal(erro.status, 403)
        assert.equal(erro.codigo, 'SEM_PERMISSAO')
        return true
      }
    )
  })
})
