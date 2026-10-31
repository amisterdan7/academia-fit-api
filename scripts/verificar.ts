// Verificação de diagnóstico e leitura do banco de dados (SOMENTE LEITURA).
// Uso:  npm run verificar
import { pool } from '../src/db'
import { config } from '../src/config'

async function verificar(): Promise<void> {
  console.log('Verificando integridade e conexão da API (somente leitura)...\n')

  try {
    const ping = await pool.query<{ agora: string }>('SELECT NOW() AS agora')
    console.log(`[OK] Conexão com o banco ativa. Hora no servidor: ${ping.rows[0]?.agora ?? 'ok'}`)

    const tabelas = ['alunos', 'planos', 'plano_recursos', 'matriculas', 'usuarios']
    for (const tabela of tabelas) {
      const reg = await pool.query<{ existe: string | null }>(
        'SELECT to_regclass($1) AS existe',
        [`public.${tabela}`]
      )
      if (reg.rows[0]?.existe) {
        const cont = await pool.query<{ total: string }>(`SELECT COUNT(*) AS total FROM ${tabela}`)
        console.log(`[OK] Tabela "${tabela}" presente (${cont.rows[0]?.total ?? 0} registros).`)
      } else {
        console.log(`[AVISO] Tabela "${tabela}" não existe no banco.`)
      }
    }

    console.log(`[OK] Fuso horário de negócio configurado: ${config.fusoNegocio}`)
    console.log('\nTudo OK! Verificação concluída com sucesso.')
  } finally {
    await pool.end()
  }
}

function dicaDeConexao(erro: unknown): string {
  const texto = erro instanceof Error ? erro.message : String(erro)
  if (/self.signed|unable to verify|SELF_SIGNED/i.test(texto)) {
    return 'Dica: baixe o certificado (Supabase > Database Settings > SSL Configuration) e aponte DATABASE_SSL_CA para ele.'
  }
  if (/altnames|Hostname\/IP/i.test(texto)) {
    return 'Dica: defina DATABASE_SSL_VERIFICAR_HOST=false no .env.'
  }
  if (/ENETUNREACH|ENOTFOUND|EAI_AGAIN|timeout/i.test(texto)) {
    return 'Dica: use a string do Session pooler (IPv4) em vez da Direct connection (IPv6).'
  }
  if (/password authentication failed/i.test(texto)) {
    return 'Dica: confira a senha na URL (caracteres como @ # / : ? precisam ser codificados).'
  }
  return ''
}

verificar().catch((erro) => {
  console.error('[FALHA] Erro durante a verificação:', erro instanceof Error ? erro.message : erro)
  const dica = dicaDeConexao(erro)
  if (dica) console.error(dica)
  process.exit(1)
})
