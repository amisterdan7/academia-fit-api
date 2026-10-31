import type { PoolClient } from 'pg'
import { config } from '../config'
import { comTransacao, pool, primeiraLinha } from '../db'
import { erros } from '../erros'

export type Aluno = { id: number; nome: string; data_nascimento: string; telefone: string | null }

export type AlunoListado = Aluno & {
  ativo: boolean
  plano_nome: string | null
  status_matricula: 'ativa' | 'inativa' | 'vencida' | 'sem_matricula'
}

export type DadosAluno = { nome: string; data_nascimento: string; telefone: string | null }

const COLUNAS = 'id, nome, data_nascimento, telefone'

// Regra do status (a MESMA para todos os apps, definida só aqui):
// vale a matrícula mais recente do aluno; se estiver "ativa" mas a data de fim já
// passou (no fuso da academia), o aluno aparece como "vencida".
export async function listar(): Promise<AlunoListado[]> {
  const r = await pool.query<AlunoListado>(
    `SELECT a.id, a.nome, a.data_nascimento, a.telefone, a.ativo,
            m.plano_nome,
            CASE
              WHEN m.id IS NULL THEN 'sem_matricula'
              WHEN m.status = 'inativa' THEN 'inativa'
              WHEN m.data_fim_estimada < (NOW() AT TIME ZONE $1::text)::date THEN 'vencida'
              ELSE 'ativa'
            END AS status_matricula
     FROM alunos a
     LEFT JOIN LATERAL (
       SELECT mt.id, mt.status, mt.data_fim_estimada, p.nome AS plano_nome
       FROM matriculas mt
       JOIN planos p ON p.id = mt.id_plano
       WHERE mt.id_aluno = a.id
       ORDER BY mt.data_inicio DESC, mt.id DESC
       LIMIT 1
     ) m ON TRUE
     ORDER BY a.nome`,
    [config.fusoNegocio]
  )
  return r.rows
}

export async function criar(dados: DadosAluno): Promise<Aluno> {
  const r = await pool.query<Aluno>(
    `INSERT INTO alunos (nome, data_nascimento, telefone)
     VALUES ($1, $2::date, $3)
     RETURNING ${COLUNAS}`,
    [dados.nome, dados.data_nascimento, dados.telefone]
  )
  return primeiraLinha(r.rows)
}

export async function atualizar(id: number, dados: DadosAluno): Promise<Aluno> {
  const r = await pool.query<Aluno>(
    `UPDATE alunos SET nome = $2, data_nascimento = $3::date, telefone = $4
     WHERE id = $1
     RETURNING ${COLUNAS}`,
    [id, dados.nome, dados.data_nascimento, dados.telefone]
  )
  const aluno = r.rows[0]
  if (!aluno) throw erros.naoEncontrado('Aluno não encontrado.')
  return aluno
}

// Arquivar (ativo = false) e restaurar (ativo = true).
export async function definirAtivo(id: number, ativo: boolean): Promise<void> {
  const r = await pool.query('UPDATE alunos SET ativo = $2 WHERE id = $1', [id, ativo])
  if (r.rowCount === 0) throw erros.naoEncontrado('Aluno não encontrado.')
}

// Exclusão definitiva: apaga as matrículas do aluno junto (tudo ou nada).
export function excluir(id: number): Promise<void> {
  return comTransacao(async (client) => {
    await client.query('DELETE FROM matriculas WHERE id_aluno = $1', [id])
    const r = await client.query('DELETE FROM alunos WHERE id = $1', [id])
    if (r.rowCount === 0) throw erros.naoEncontrado('Aluno não encontrado.')
  })
}

// Para o formulário público do site: se a pessoa já existe (mesmo nome e nascimento),
// reaproveita o cadastro em vez de duplicar.
export async function buscarOuCriarPublico(
  client: PoolClient,
  dados: DadosAluno
): Promise<{ id: number; existente: boolean }> {
  const achado = await client.query<{ id: number; ativo: boolean }>(
    `SELECT id, ativo FROM alunos
     WHERE lower(btrim(nome)) = lower($1::text) AND data_nascimento = $2::date
     ORDER BY id
     LIMIT 1`,
    [dados.nome, dados.data_nascimento]
  )

  const existente = achado.rows[0]
  if (existente) {
    if (!existente.ativo) {
      throw erros.conflito('Cadastro indisponível no momento. Procure a recepção da academia.')
    }
    return { id: existente.id, existente: true }
  }

  const novo = await client.query<{ id: number }>(
    `INSERT INTO alunos (nome, data_nascimento, telefone)
     VALUES ($1, $2::date, $3)
     RETURNING id`,
    [dados.nome, dados.data_nascimento, dados.telefone]
  )
  return { id: primeiraLinha(novo.rows).id, existente: false }
}
