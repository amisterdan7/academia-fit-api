import { criarApp } from './app'
import { config } from './config'
import { pool } from './db'
import { garantirTabela } from './servicos/usuarios'

// Traduz os erros de conexão mais comuns com o Supabase em um próximo passo concreto.
function dicaDeConexao(erro: unknown): string {
  const texto = erro instanceof Error ? erro.message : String(erro)
  if (/self.signed|unable to verify|SELF_SIGNED/i.test(texto)) {
    return 'Dica: baixe o certificado (Supabase > Database Settings > SSL Configuration) e aponte DATABASE_SSL_CA para ele.'
  }
  if (/altnames|Hostname\/IP/i.test(texto)) {
    return 'Dica: defina DATABASE_SSL_VERIFICAR_HOST=false no .env.'
  }
  if (/ENETUNREACH|ENOTFOUND|EAI_AGAIN/i.test(texto)) {
    return 'Dica: use a string do Session pooler (IPv4) em vez da Direct connection (IPv6).'
  }
  if (/password authentication failed/i.test(texto)) {
    return 'Dica: confira a senha na URL (caracteres como @ # / : ? precisam ser codificados).'
  }
  return ''
}

async function iniciar(): Promise<void> {
  try {
    await garantirTabela()
  } catch (erro) {
    // Não derruba a API: planos e matrículas do site continuam funcionando.
    console.error('Aviso: não foi possível garantir a tabela de usuários:', erro)
    const dica = dicaDeConexao(erro)
    if (dica) console.error(dica)
  }

  const servidor = criarApp().listen(config.porta, () => {
    console.log(`Servidor rodando na porta ${config.porta} 🚀`)
  })

  // Encerramento limpo quando a plataforma reinicia ou para o serviço.
  const encerrar = (sinal: string): void => {
    console.log(`${sinal} recebido, encerrando...`)
    servidor.close(() => {
      void pool.end().finally(() => process.exit(0))
    })
    setTimeout(() => process.exit(1), 10_000).unref()
  }
  process.on('SIGTERM', () => encerrar('SIGTERM'))
  process.on('SIGINT', () => encerrar('SIGINT'))
}

iniciar().catch((erro) => {
  console.error('Falha ao iniciar a API:', erro)
  process.exit(1)
})
