import { Router } from 'express'
import { exigir, usuarioAtual } from '../auth/middleware'
import { erros } from '../erros'
import * as usuarios from '../servicos/usuarios'
import { ativoSchema, idDe, novoUsuarioSchema, redefinirSenhaSchema, validar } from '../validacao'

// Montada em /v1/usuarios, já atrás de `autenticar`. Hoje só o administrador tem essas permissões.
export const rotasUsuarios: Router = Router()

rotasUsuarios.get('/', exigir('usuarios:listar'), async (_req, res) => {
  res.json(await usuarios.listar())
})

rotasUsuarios.post('/', exigir('usuarios:criar'), async (req, res) => {
  res.status(201).json(await usuarios.criar(validar(novoUsuarioSchema, req.body)))
})

rotasUsuarios.patch('/:id/ativo', exigir('usuarios:alterar-ativo'), async (req, res) => {
  const id = idDe(req.params)
  const { ativo } = validar(ativoSchema, req.body)

  if (!ativo && id === usuarioAtual(res).id) {
    throw erros.conflito('Você não pode desativar o próprio usuário.')
  }
  res.json(await usuarios.alterarAtivo(id, ativo))
})

// O administrador define uma senha nova (por exemplo, quando alguém esquece a dele).
rotasUsuarios.put('/:id/senha', exigir('usuarios:redefinir-senha'), async (req, res) => {
  const { senha } = validar(redefinirSenhaSchema, req.body)
  await usuarios.definirSenha(idDe(req.params), senha)
  res.status(204).end()
})
