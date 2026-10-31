import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { erros } from '../erros'
import { buscarAtivoPorId } from '../servicos/usuarios'
import { temPermissao, type Perfil } from './permissoes'
import { lerToken } from './token'

export type UsuarioAutenticado = { id: number; nome: string; login: string; perfil: Perfil }

// Exige "Authorization: Bearer <token>" e confere no banco se o usuário ainda está ativo.
export async function autenticar(req: Request, res: Response, next: NextFunction): Promise<void> {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ')
  if (tipo !== 'Bearer' || !token) throw erros.naoAutenticado()

  const id = lerToken(token)
  if (id === null) {
    throw erros.naoAutenticado('Sessão inválida ou expirada. Faça login novamente.')
  }

  const usuario = await buscarAtivoPorId(id)
  if (!usuario) throw erros.naoAutenticado('Usuário inexistente ou desativado.')

  res.locals['usuario'] = usuario
  next()
}

export function usuarioAtual(res: Response): UsuarioAutenticado {
  const usuario = res.locals['usuario'] as UsuarioAutenticado | undefined
  if (!usuario) throw erros.naoAutenticado()
  return usuario
}

// Use depois de `autenticar`: exigir('alunos:excluir')
export function exigir(acao: string): RequestHandler {
  return (_req, res, next) => {
    if (!temPermissao(usuarioAtual(res).perfil, acao)) throw erros.semPermissao()
    next()
  }
}
