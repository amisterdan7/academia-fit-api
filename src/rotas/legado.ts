import { Router } from 'express'
import { converterErro } from '../middleware/erros'
import { criarLimite } from '../middleware/limites'
import * as matriculas from '../servicos/matriculas'
import * as planos from '../servicos/planos'
import { matriculaLegadaSchema, validar } from '../validacao'

// Rotas ANTIGAS, na raiz, com o formato de resposta que a vitrine já usa.
// Mantidas até o site migrar para /v1/planos e /v1/publico/pre-matriculas.
export const rotasLegado: Router = Router()

const limiteMatricula = criarLimite({ janelaMin: 60, max: 20, formato: 'legado' })

// GET /planos  ->  lista com "features" (textos)
rotasLegado.get('/planos', async (_req, res) => {
  try {
    res.json(await planos.listarLegado())
  } catch (erro) {
    console.error('Erro ao buscar planos:', erro)
    res.status(500).json({ sucesso: false, erro: 'Falha ao carregar os planos.' })
  }
})

// POST /matriculas  { nome, data_nascimento, telefone, nome_plano }
//   ->  { sucesso: true, mensagem, alunoId }   ou   { sucesso: false, erro }
rotasLegado.post('/matriculas', limiteMatricula, async (req, res) => {
  try {
    const dados = validar(matriculaLegadaSchema, req.body)
    const resultado = await matriculas.matricularDoSite(
      { nome: dados.nome, data_nascimento: dados.data_nascimento, telefone: dados.telefone },
      dados.nome_plano
    )
    res.status(201).json({
      sucesso: true,
      mensagem: 'Matrícula efetuada com sucesso!',
      alunoId: resultado.alunoId
    })
  } catch (erro) {
    const { status, corpo } = converterErro(erro)
    if (status >= 500) console.error('Erro ao registrar matrícula:', erro)
    const erroMensagem =
      status === 409 ? 'Não foi possível concluir. Procure a recepção da academia.' : corpo.error.message
    res.status(status).json({ sucesso: false, erro: erroMensagem })
  }
})
