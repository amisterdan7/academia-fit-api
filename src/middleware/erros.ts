import type { NextFunction, Request, Response } from 'express'
import { ErroHttp, codigoPg } from '../erros'

export type CorpoErro = { error: { code: string; message: string; details?: unknown } }

function montarCorpo(codigo: string, mensagem: string, detalhes?: unknown): CorpoErro {
  return {
    error: { code: codigo, message: mensagem, ...(detalhes === undefined ? {} : { details: detalhes }) }
  }
}

// O body-parser do Express (JSON malformado, corpo grande demais) lança erros com `status`.
function statusDeCorpoInvalido(erro: unknown): number | null {
  const status = (erro as { status?: unknown } | null)?.status
  return typeof status === 'number' && status >= 400 && status < 500 ? status : null
}

// Transforma qualquer erro em { status, corpo }. Também é usado pelas rotas legadas.
export function converterErro(erro: unknown): { status: number; corpo: CorpoErro } {
  if (erro instanceof ErroHttp) {
    return { status: erro.status, corpo: montarCorpo(erro.codigo, erro.message, erro.detalhes) }
  }

  const pg = codigoPg(erro)
  if (pg === '23505') {
    return { status: 409, corpo: montarCorpo('CONFLITO', 'Já existe um registro com esses dados.') }
  }
  if (pg === '23503') {
    return {
      status: 409,
      corpo: montarCorpo('CONFLITO', 'Não é possível concluir: há um vínculo com outro registro.')
    }
  }
  if (pg === '23502') {
    return {
      status: 400,
      corpo: montarCorpo('VALIDACAO', 'Um campo obrigatório não foi preenchido.')
    }
  }
  if (pg === '22001') {
    return {
      status: 400,
      corpo: montarCorpo('VALIDACAO', 'Valor fornecido excede o limite de caracteres permitido.')
    }
  }

  const texto = `${pg ?? ''} ${erro instanceof Error ? erro.message : ''}`
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|SSL|timeout/i.test(texto)) {
    return {
      status: 503,
      corpo: montarCorpo(
        'BANCO_INDISPONIVEL',
        'Não foi possível conectar ao banco de dados. Tente novamente em instantes.'
      )
    }
  }

  const statusCorpo = statusDeCorpoInvalido(erro)
  if (statusCorpo !== null) {
    const mensagem =
      statusCorpo === 413
        ? 'O corpo da requisição é grande demais.'
        : 'Requisição inválida. Confira se o JSON está correto.'
    return { status: statusCorpo, corpo: montarCorpo('REQUISICAO_INVALIDA', mensagem) }
  }

  return {
    status: 500,
    corpo: montarCorpo('ERRO_INTERNO', 'Ocorreu um erro inesperado. Tente novamente em instantes.')
  }
}

export function rotaNaoEncontrada(_req: Request, res: Response): void {
  res.status(404).json(montarCorpo('NAO_ENCONTRADO', 'Rota não encontrada.'))
}

// O Express só reconhece como "tratador de erro" uma função com 4 parâmetros.
export function tratarErros(erro: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(erro)
    return
  }

  const { status, corpo } = converterErro(erro)
  if (status >= 500) console.error(`[${req.method} ${req.originalUrl}]`, erro)

  // Rotas legadas (/planos, /matriculas) mantêm contrato { sucesso: false, erro }
  if (req.path === '/matriculas' || req.path === '/planos') {
    res.status(status).json({ sucesso: false, erro: corpo.error.message })
    return
  }

  res.status(status).json(corpo)
}
