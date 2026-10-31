// Completa o .env SEM apagar nada do que já existe: só acrescenta o que estiver faltando.
// Uso:  node setup-env.mjs
import crypto from 'node:crypto'
import fs from 'node:fs'

const padroes = {
  DATABASE_URL: '"postgresql://postgres:128anwrMxPPwrMdk@db.eptyjpdpcvindwlspewb.supabase.co:5432/postgres"',
  DATABASE_SSL_CA: './certs/supabase-ca.crt',
  DATABASE_SSL_VERIFICAR_HOST: 'true',
  PORT: '3333',
  JWT_SECRET: crypto.randomBytes(48).toString('base64url'),
  JWT_EXPIRA_HORAS: '8',
  CORS_ORIGINS: 'http://localhost:5173',
  TRUST_PROXY: '0',
  FUSO_NEGOCIO: 'America/Sao_Paulo'
}

const atual = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : ''
const existentes = new Set([...atual.matchAll(/^\s*([A-Z_]+)\s*=/gm)].map((m) => m[1]))
const faltando = Object.entries(padroes).filter(([chave]) => !existentes.has(chave))

if (faltando.length === 0) {
  console.log('.env já está completo. Nada foi alterado.')
  process.exit(0)
}

const separador = atual === '' || atual.endsWith('\n') ? '' : '\n'
const bloco = faltando.map(([chave, valor]) => `${chave}=${valor}`).join('\n') + '\n'
fs.appendFileSync('.env', separador + bloco, 'utf8')

console.log(`.env atualizado. Adicionado: ${faltando.map(([chave]) => chave).join(', ')}`)
if (faltando.some(([chave]) => chave === 'DATABASE_URL')) {
  console.log('Edite o .env e coloque a URI do Session pooler do Supabase em DATABASE_URL.')
}