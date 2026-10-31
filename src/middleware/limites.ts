import type { RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'

type Opcoes = { janelaMin: number; max: number; formato?: 'v1' | 'legado' }

// Limite de requisições por IP. Atrás de proxy (Render, Railway...), defina TRUST_PROXY=1,
// senão todos os visitantes parecem ter o mesmo IP.
export function criarLimite(opcoes: Opcoes): RequestHandler {
  const formato = opcoes.formato ?? 'v1'

  return rateLimit({
    windowMs: opcoes.janelaMin * 60_000,
    limit: opcoes.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      const mensagem = 'Muitas requisições. Tente novamente em alguns minutos.'
      if (formato === 'legado') {
        res.status(429).json({ sucesso: false, erro: mensagem })
      } else {
        res.status(429).json({ error: { code: 'LIMITE_EXCEDIDO', message: mensagem } })
      }
    }
  })
}
