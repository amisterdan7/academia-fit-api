// Cria o primeiro administrador (ou recupera o acesso quando a senha se perdeu).
// Uso:  npm run criar-admin
import readline from 'node:readline'
import { Writable } from 'node:stream'
import { pool } from '../db'
import {
  alterarAtivo,
  buscarPorLogin,
  criar,
  definirSenha,
  garantirTabela
} from '../servicos/usuarios'
import { novoUsuarioSchema, validar } from '../validacao'

// Saída "silenciável": enquanto digita a senha, nada aparece na tela.
let silenciar = false
const saida = new Writable({
  write(trecho, _codificacao, pronto) {
    if (!silenciar) process.stdout.write(trecho)
    pronto()
  }
})

const entrada = readline.createInterface({
  input: process.stdin,
  output: saida,
  terminal: Boolean(process.stdin.isTTY)
})
const linhas = entrada[Symbol.asyncIterator]()

async function perguntar(texto: string, secreto = false): Promise<string> {
  process.stdout.write(texto)
  silenciar = secreto
  const { value, done } = await linhas.next()
  silenciar = false
  if (secreto) process.stdout.write('\n')
  if (done) throw new Error('Entrada encerrada antes de terminar.')
  return String(value)
}

async function principal(): Promise<void> {
  await garantirTabela()
  console.log('Criar (ou recuperar) um administrador da Academia MisterFit\n')

  const nome = (await perguntar('Nome completo: ')).trim()
  const login = (await perguntar('Usuário (login): ')).trim().toLowerCase()
  const senha = await perguntar('Senha (mínimo de 8 caracteres): ', true)
  const confirmar = await perguntar('Repita a senha: ', true)

  if (senha !== confirmar) throw new Error('As senhas não conferem.')
  const dados = validar(novoUsuarioSchema, { nome, login, senha, perfil: 'admin' })

  const existente = await buscarPorLogin(dados.login)
  if (existente) {
    const resposta = await perguntar(
      `O usuário "${dados.login}" já existe. Redefinir a senha e reativar? (s/N) `
    )
    if (resposta.trim().toLowerCase() !== 's') {
      console.log('Nada foi alterado.')
      return
    }
    await definirSenha(existente.id, dados.senha)
    await alterarAtivo(existente.id, true)
    console.log('Senha redefinida e usuário reativado (o perfil dele não foi alterado).')
    return
  }

  await criar(dados)
  console.log(`Administrador "${dados.login}" criado com sucesso.`)
}

principal()
  .catch((erro: unknown) => {
    console.error('Erro:', erro instanceof Error ? erro.message : erro)
    process.exitCode = 1
  })
  .finally(async () => {
    entrada.close()
    await pool.end()
  })
