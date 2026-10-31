import cors, { type CorsOptions } from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'
import { config } from './config'
import { pool } from './db'
import { rotaNaoEncontrada, tratarErros } from './middleware/erros'
import { rotasLegado } from './rotas/legado'
import { v1 } from './rotas/v1'

// Navegadores só podem chamar a API a partir dos domínios de CORS_ORIGINS.
// Desktop e app mobile não enviam "Origin", então passam normalmente.
const origem: NonNullable<CorsOptions['origin']> = (origemDaRequisicao, retorno) => {
  if (!origemDaRequisicao) return retorno(null, true)
  if (config.origensPermitidas.includes(origemDaRequisicao)) return retorno(null, true)

  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origemDaRequisicao)
  return retorno(null, config.ambiente !== 'production' && local)
}

export function criarApp(): Express {
  const app = express()

  if (config.confiarProxy > 0) app.set('trust proxy', config.confiarProxy)

  app.use(helmet())
  app.use(
    cors({
      origin: origem,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    })
  )
  app.use(express.json({ limit: '100kb' }))

  // Verificações de saúde (para a plataforma de deploy). A segunda também testa o banco.
  app.get('/saude', (_req, res) => {
    res.json({ ok: true })
  })
  app.get('/saude/banco', async (_req, res) => {
    try {
      await pool.query('SELECT 1')
      res.json({ ok: true })
    } catch {
      res.status(503).json({ ok: false })
    }
  })

  app.use('/v1', v1)
  app.use(rotasLegado)

  app.use(rotaNaoEncontrada)
  app.use(tratarErros)

  return app
}
