import { Router } from 'express'
import { exigir } from '../auth/middleware'
import * as matriculas from '../servicos/matriculas'
import { idDe, matriculaSchema, statusMatriculaSchema, validar } from '../validacao'

// Montada em /v1/matriculas, já atrás de `autenticar`.
export const rotasMatriculas: Router = Router()

rotasMatriculas.get('/', exigir('matriculas:listar'), async (_req, res) => {
  res.json(await matriculas.listar())
})

// { id_aluno, id_plano, data_inicio? }  ->  a API calcula data_fim_estimada
rotasMatriculas.post('/', exigir('matriculas:criar'), async (req, res) => {
  const { id_aluno, id_plano, data_inicio } = validar(matriculaSchema, req.body)
  res.status(201).json(await matriculas.criar(id_aluno, id_plano, data_inicio))
})

rotasMatriculas.patch('/:id/status', exigir('matriculas:atualizar-status'), async (req, res) => {
  const { status } = validar(statusMatriculaSchema, req.body)
  await matriculas.atualizarStatus(idDe(req.params), status)
  res.status(204).end()
})

rotasMatriculas.delete('/:id', exigir('matriculas:excluir'), async (req, res) => {
  await matriculas.excluir(idDe(req.params))
  res.status(204).end()
})
