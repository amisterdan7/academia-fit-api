import type { ConnectionOptions } from 'node:tls'
import { Pool, types, type PoolClient } from 'pg'
import { config } from './config'

// DATE vira texto "AAAA-MM-DD". Sem isso o pg cria um Date no fuso do servidor
// e a data pode "voltar um dia" quando vira JSON.
types.setTypeParser(1082, (valor: string) => valor)

// Com o certificado do banco, o SSL é configurado aqui (verificando a cadeia do certificado).
// O `sslmode=` da URL, se existir, é removido: o pg o usaria para sobrescrever esta configuração.
function configurarSsl(): ConnectionOptions | undefined {
  if (!config.databaseCa) return undefined
  return {
    rejectUnauthorized: true,
    ca: config.databaseCa,
    ...(config.databaseVerificarHost ? {} : { checkServerIdentity: () => undefined })
  }
}

function urlDoBanco(): string {
  if (!config.databaseCa) return config.databaseUrl
  try {
    const url = new URL(config.databaseUrl)
    url.searchParams.delete('sslmode')
    return url.toString()
  } catch {
    return config.databaseUrl
  }
}

const ssl = configurarSsl()

export const pool = new Pool({
  connectionString: urlDoBanco(),
  connectionTimeoutMillis: 15_000, // bancos na nuvem podem levar alguns segundos para responder
  idleTimeoutMillis: 30_000,
  ...(ssl ? { ssl } : {})
})

// Sem este handler, uma conexão ociosa derrubada pelo Supabase encerra o processo inteiro.
pool.on('error', (erro: Error) => {
  console.error('Erro em conexão ociosa do banco:', erro.message)
})

// Tudo ou nada: se qualquer passo falhar, nada é gravado.
export async function comTransacao<T>(operacao: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const resultado = await operacao(client)
    await client.query('COMMIT')
    return resultado
  } catch (erro) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw erro
  } finally {
    client.release()
  }
}

// Com noUncheckedIndexedAccess, rows[0] pode ser undefined: este helper resolve isso.
export function primeiraLinha<T>(linhas: T[]): T {
  const linha = linhas[0]
  if (linha === undefined) throw new Error('A consulta não retornou nenhuma linha.')
  return linha
}
