import jwt from 'jsonwebtoken'
import { config } from '../config'

// O token guarda só o id do usuário. Perfil e "ativo" são lidos do banco a cada
// requisição, então desativar alguém ou mudar o perfil vale na hora.
export function gerarToken(idUsuario: number): string {
  return jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS256',
    subject: String(idUsuario),
    expiresIn: config.jwtHoras * 3600
  })
}

// Devolve o id do usuário, ou null se o token for inválido ou estiver expirado.
export function lerToken(token: string): number | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] })
    if (typeof payload === 'string') return null

    const id = Number(payload.sub)
    return Number.isInteger(id) && id > 0 ? id : null
  } catch {
    return null
  }
}
