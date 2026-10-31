import { pool } from '../db'
import { codigoPg, erros } from '../erros'
import { gerarHash } from '../auth/senha'
import type { Perfil } from '../auth/permissoes'

export type Usuario = { id: number; nome: string; login: string; perfil: Perfil; ativo: boolean }
export type UsuarioComSenha = Usuario & { senha_hash: string }

const COLUNAS = 'id, nome, login, perfil, ativo'

// Mesma tabela criada pelo aplicativo desktop (CREATE ... IF NOT EXISTS não altera o que já existe).
export async function garantirTabela(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id         SERIAL PRIMARY KEY,
      nome       VARCHAR(100) NOT NULL,
      login      VARCHAR(30)  NOT NULL UNIQUE,
      senha_hash TEXT         NOT NULL,
      perfil     VARCHAR(20)  NOT NULL CHECK (perfil IN ('admin', 'recepcao')),
      ativo      BOOLEAN      NOT NULL DEFAULT TRUE,
      criado_em  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `)
}

export async function buscarAtivoPorId(id: number): Promise<Usuario | null> {
  const r = await pool.query<Usuario>(
    `SELECT ${COLUNAS} FROM usuarios WHERE id = $1 AND ativo = TRUE`,
    [id]
  )
  return r.rows[0] ?? null
}

export async function buscarPorLogin(login: string): Promise<UsuarioComSenha | null> {
  const r = await pool.query<UsuarioComSenha>(
    `SELECT ${COLUNAS}, senha_hash FROM usuarios WHERE login = $1`,
    [login]
  )
  return r.rows[0] ?? null
}

export async function buscarSenhaHash(id: number): Promise<string | null> {
  const r = await pool.query<{ senha_hash: string }>(
    'SELECT senha_hash FROM usuarios WHERE id = $1',
    [id]
  )
  return r.rows[0]?.senha_hash ?? null
}

export async function listar(): Promise<Usuario[]> {
  const r = await pool.query<Usuario>(`SELECT ${COLUNAS} FROM usuarios ORDER BY nome`)
  return r.rows
}

type NovoUsuario = { nome: string; login: string; senha: string; perfil: Perfil }

export async function criar(dados: NovoUsuario): Promise<Usuario> {
  const hash = await gerarHash(dados.senha)
  try {
    const r = await pool.query<Usuario>(
      `INSERT INTO usuarios (nome, login, senha_hash, perfil)
       VALUES ($1, $2, $3, $4)
       RETURNING ${COLUNAS}`,
      [dados.nome, dados.login, hash, dados.perfil]
    )
    const criado = r.rows[0]
    if (!criado) throw new Error('O usuário não foi criado.')
    return criado
  } catch (erro) {
    if (codigoPg(erro) === '23505') {
      throw erros.conflito('Esse usuário já existe. Escolha outro login.')
    }
    throw erro
  }
}

export async function alterarAtivo(id: number, ativo: boolean): Promise<Usuario> {
  const r = await pool.query<Usuario>(
    `UPDATE usuarios SET ativo = $2 WHERE id = $1 RETURNING ${COLUNAS}`,
    [id, ativo]
  )
  const atualizado = r.rows[0]
  if (!atualizado) throw erros.naoEncontrado('Usuário não encontrado.')
  return atualizado
}

export async function definirSenha(id: number, senha: string): Promise<void> {
  const hash = await gerarHash(senha)
  const r = await pool.query('UPDATE usuarios SET senha_hash = $2 WHERE id = $1', [id, hash])
  if (r.rowCount === 0) throw erros.naoEncontrado('Usuário não encontrado.')
}
