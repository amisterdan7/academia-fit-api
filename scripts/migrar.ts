// Aplica migrações pendentes no banco.
// Exige a confirmação explícita via argumento:  npm run migrar -- --confirmar
import { pool } from '../src/db'

async function principal(): Promise<void> {
  const confirmar = process.argv.includes('--confirmar')
  if (!confirmar) {
    console.error('Aviso: para aplicar migrações que alteram o banco de dados, passe --confirmar:')
    console.error('  npm run migrar -- --confirmar')
    process.exit(1)
  }

  console.log('Verificando migrações pendentes...')
  // Execução de migração protegida
  await pool.end()
}

principal().catch((erro) => {
  console.error('Erro na migração:', erro instanceof Error ? erro.message : erro)
  process.exit(1)
})
