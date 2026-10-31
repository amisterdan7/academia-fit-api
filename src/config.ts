import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

dotenv.config()

function obrigatoria(nome: string): string {
  const valor = process.env[nome]?.trim()
  if (!valor) {
    throw new Error(
      `Variável de ambiente ${nome} não definida. Rode "node setup-env.mjs" para completar o .env.`
    )
  }
  return valor
}

function inteiro(nome: string, padrao: number): number {
  const bruto = process.env[nome]
  if (bruto === undefined || bruto.trim() === '') return padrao

  const numero = Number(bruto)
  if (!Number.isFinite(numero)) throw new Error(`${nome} deve ser um número.`)
  return numero
}

// Certificado (CA) do banco. O Supabase usa uma autoridade própria que o Node não conhece,
// então é preciso entregar o certificado. Aceita o caminho do arquivo .crt ou o texto do
// certificado (com \n no lugar das quebras de linha, útil em Render/Railway).
function lerCertificado(): string | undefined {
  const bruto = process.env['DATABASE_SSL_CA']?.trim()
  if (!bruto) return undefined
  if (bruto.includes('BEGIN CERTIFICATE')) return bruto.replace(/\\n/g, '\n')

  const caminho = path.resolve(bruto)
  if (!fs.existsSync(caminho)) {
    throw new Error(`DATABASE_SSL_CA aponta para um arquivo que não existe: ${caminho}`)
  }
  return fs.readFileSync(caminho, 'utf8')
}

const jwtSecret = obrigatoria('JWT_SECRET')
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres. Rode "node setup-env.mjs".')
}

// Falha na inicialização se algo essencial faltar: melhor do que subir a API quebrada.
export const config = {
  ambiente: process.env['NODE_ENV'] ?? 'development',
  porta: inteiro('PORT', 3333),
  databaseUrl: obrigatoria('DATABASE_URL'),
  databaseCa: lerCertificado(),
  databaseVerificarHost: process.env['DATABASE_SSL_VERIFICAR_HOST'] !== 'false',
  jwtSecret,
  jwtHoras: inteiro('JWT_EXPIRA_HORAS', 8),
  fusoNegocio: process.env['FUSO_NEGOCIO'] ?? 'America/Sao_Paulo',
  confiarProxy: inteiro('TRUST_PROXY', 0),
  origensPermitidas: (process.env['CORS_ORIGINS'] ?? '')
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean)
}
