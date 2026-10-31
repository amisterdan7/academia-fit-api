import { Router } from 'express'
import { autenticar, usuarioAtual } from '../auth/middleware'
import { limparFalhas, registrarFalha, segundosDeBloqueio } from '../auth/bloqueio'
import { permissoesDe } from '../auth/permissoes'
import { HASH_INEXISTENTE, conferirSenha } from '../auth/senha'
import { gerarToken } from '../auth/token'
import { erros } from '../erros'
import { criarLimite } from '../middleware/limites'
import { buscarPorLogin, buscarSenhaHash, definirSenha } from '../servicos/usuarios'
import { loginSchema, trocarSenhaSchema, validar } from '../validacao'

export const rotasAuth: Router = Router()

const limiteLogin = criarLimite({ janelaMin: 15, max: 30 })

// POST /v1/auth/login  { login, senha }  ->  { token, usuario, permissoes }
rotasAuth.post('/login', limiteLogin, async (req, res) => {
  const { login, senha } = validar(loginSchema, req.body)

  const segundos = segundosDeBloqueio(login)
  if (segundos > 0) {
    throw erros.muitasTentativas(`Muitas tentativas. Tente novamente em ${segundos} segundos.`)
  }

  const usuario = await buscarPorLogin(login)
  const senhaOk = await conferirSenha(senha, usuario?.senha_hash ?? HASH_INEXISTENTE)

  if (!usuario || !senhaOk) {
    registrarFalha(login)
    throw erros.naoAutenticado('Usuário ou senha incorretos.')
  }
  if (!usuario.ativo) throw erros.usuarioDesativado()

  limparFalhas(login)
  res.json({
    token: gerarToken(usuario.id),
    usuario: { id: usuario.id, nome: usuario.nome, login: usuario.login, perfil: usuario.perfil },
    permissoes: permissoesDe(usuario.perfil)
  })
})

// GET /v1/auth/eu  ->  quem está logado e o que pode fazer (útil ao reabrir o app)
rotasAuth.get('/eu', autenticar, (_req, res) => {
  const usuario = usuarioAtual(res)
  res.json({ usuario, permissoes: permissoesDe(usuario.perfil) })
})

// POST /v1/auth/trocar-senha  { senha_atual, nova_senha }
rotasAuth.post('/trocar-senha', limiteLogin, autenticar, async (req, res) => {
  const { senha_atual, nova_senha } = validar(trocarSenhaSchema, req.body)
  const usuario = usuarioAtual(res)

  const hash = await buscarSenhaHash(usuario.id)
  if (!(await conferirSenha(senha_atual, hash ?? HASH_INEXISTENTE))) {
    // 400 (e não 401) para o app não confundir com "sessão expirada".
    throw erros.validacao('Senha atual incorreta.')
  }

  await definirSenha(usuario.id, nova_senha)
  res.status(204).end()
})
