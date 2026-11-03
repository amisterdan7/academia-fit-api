import { Router } from 'express'
import { exigir, usuarioAtual } from '../auth/middleware'
import { exigirPermissaoCriacaoAluno } from '../auth/permissoes'
import * as alunos from '../servicos/alunos'
import { alunoSchema, ativoSchema, idDe, validar } from '../validacao'

// Montada em /v1/alunos, já atrás de `autenticar`.
export const rotasAlunos: Router = Router()
export { exigirPermissaoCriacaoAluno }

rotasAlunos.get('/', exigir('alunos:listar'), async (_req, res) => {
  res.json(await alunos.listar())
})

rotasAlunos.post('/', exigir('alunos:criar'), async (req, res) => {
  const dados = validar(alunoSchema, req.body)
  if (dados.id_plano !== null) {
    exigirPermissaoCriacaoAluno(usuarioAtual(res).perfil, true)
    res.status(201).json(
      await alunos.criarComMatricula(
        { nome: dados.nome, data_nascimento: dados.data_nascimento, telefone: dados.telefone },
        dados.id_plano,
        dados.data_inicio
      )
    )
    return
  }

  res.status(201).json(
    await alunos.criar({
      nome: dados.nome,
      data_nascimento: dados.data_nascimento,
      telefone: dados.telefone
    })
  )
})

rotasAlunos.put('/:id', exigir('alunos:atualizar'), async (req, res) => {
  res.json(await alunos.atualizar(idDe(req.params), validar(alunoSchema, req.body)))
})

// Arquivar e restaurar usam a mesma permissão ('alunos:desativar'), como no desktop.
rotasAlunos.patch('/:id/ativo', exigir('alunos:desativar'), async (req, res) => {
  const { ativo } = validar(ativoSchema, req.body)
  await alunos.definirAtivo(idDe(req.params), ativo)
  res.status(204).end()
})

rotasAlunos.delete('/:id', exigir('alunos:excluir'), async (req, res) => {
  await alunos.excluir(idDe(req.params))
  res.status(204).end()
})
