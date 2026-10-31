import { Router } from 'express'
import { criarLimite } from '../middleware/limites'
import * as matriculas from '../servicos/matriculas'
import { preMatriculaSchema, validar } from '../validacao'

export const rotasPublico: Router = Router()

// Poucas tentativas por hora e por IP: é uma rota aberta a qualquer visitante.
const limite = criarLimite({ janelaMin: 60, max: 20 })

// POST /v1/publico/pre-matriculas  { nome, data_nascimento, telefone?, id_plano }
rotasPublico.post('/pre-matriculas', limite, async (req, res) => {
  const dados = validar(preMatriculaSchema, req.body)
  const resultado = await matriculas.matricularDoSite(
    { nome: dados.nome, data_nascimento: dados.data_nascimento, telefone: dados.telefone },
    dados.id_plano
  )
  res.status(201).json({ mensagem: 'Matrícula efetuada com sucesso!', ...resultado })
})
