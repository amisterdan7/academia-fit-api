// Executa o fluxo de testes E2E com escrita no banco.
// Exige a variável de ambiente CONFIRMO_ESCREVER=sim para evitar escrita acidental.
// Uso:  CONFIRMO_ESCREVER=sim npm run test:e2e
import { spawnSync } from 'node:child_process'

if (process.env.CONFIRMO_ESCREVER !== 'sim') {
  console.error('ERRO: Os testes E2E escrevem no banco de dados.')
  console.error('Para executar, defina a variável CONFIRMO_ESCREVER=sim:')
  console.error('  CONFIRMO_ESCREVER=sim npm run test:e2e')
  process.exit(1)
}

console.log('1/2. Executando verificação de leitura...')
const resVerificar = spawnSync('npm', ['run', 'verificar'], { stdio: 'inherit' })
if (resVerificar.status !== 0) {
  process.exit(resVerificar.status ?? 1)
}

console.log('\n2/2. Executando testes contra a API (testar:cliente)...')
const resCliente = spawnSync('npm', ['run', 'testar:cliente'], { stdio: 'inherit' })
if (resCliente.status !== 0) {
  process.exit(resCliente.status ?? 1)
}
