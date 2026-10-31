import { Router } from 'express'
import { autenticar, exigir } from '../auth/middleware'
import * as planos from '../servicos/planos'
import { idDe, planoSchema, validar } from '../validacao'

export const rotasPlanos: Router = Router()

// Público: a vitrine e o app mostram os planos antes de qualquer login.
rotasPlanos.get('/', async (_req, res) => {
  res.json(await planos.listar())
})

rotasPlanos.post('/', autenticar, exigir('planos:criar'), async (req, res) => {
  res.status(201).json(await planos.criar(validar(planoSchema, req.body)))
})

rotasPlanos.put('/:id', autenticar, exigir('planos:atualizar'), async (req, res) => {
  res.json(await planos.atualizar(idDe(req.params), validar(planoSchema, req.body)))
})

rotasPlanos.delete('/:id', autenticar, exigir('planos:excluir'), async (req, res) => {
  await planos.excluir(idDe(req.params))
  res.status(204).end()
})
