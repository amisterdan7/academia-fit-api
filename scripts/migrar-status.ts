// Consulta o status das migrações (SOMENTE LEITURA).
// Se schema_migrations não existir, lista todas como pendentes SEM criar nada no banco.
// Uso:  npm run migrar:status
import { pool } from '../src/db'

const TODAS_MIGRACOES = [
  '001_esquema_inicial',
  '002_usuarios'
]

async function principal(): Promise<void> {
  try {
    const reg = await pool.query<{ existe: string | null }>(
      "SELECT to_regclass('public.schema_migrations') AS existe"
    )

    if (!reg.rows[0]?.existe) {
      console.log('Tabela "schema_migrations" não encontrada no banco (nenhuma migração foi executada).')
      console.log('Status das migrações:')
      for (const m of TODAS_MIGRACOES) {
        console.log(`  [PENDENTE] ${m}`)
      }
      return
    }

    const aplicadas = await pool.query<{ versao: string }>(
      'SELECT versao FROM schema_migrations ORDER BY versao'
    )
    const versoesAplicadas = new Set(aplicadas.rows.map((r) => r.versao))

    console.log('Status das migrações:')
    for (const m of TODAS_MIGRACOES) {
      if (versoesAplicadas.has(m)) {
        console.log(`  [APLICADA] ${m}`)
      } else {
        console.log(`  [PENDENTE] ${m}`)
      }
    }
  } finally {
    await pool.end()
  }
}

principal().catch((erro) => {
  console.error('Erro ao verificar status das migrações:', erro instanceof Error ? erro.message : erro)
  process.exit(1)
})
