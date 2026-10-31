import type { PoolClient } from 'pg'
import { config } from '../config'
import { comTransacao, pool, primeiraLinha } from '../db'
import { erros } from '../erros'
import { buscarOuCriarPublico, type DadosAluno } from './alunos'

export type Matricula = {
  id: number
  id_aluno: number
  id_plano: number
  data_inicio: string
  data_fim_estimada: string
  status: string
}

export type MatriculaComNomes = Matricula & { aluno_nome: string; plano_nome: string }

// "vencida" não é gravada: é calculada (ativa + data de fim já passou, no fuso da academia).
export async function listar(): Promise<MatriculaComNomes[]> {
  const r = await pool.query<MatriculaComNomes>(
    `SELECT m.id, m.id_aluno, m.id_plano, m.data_inicio, m.data_fim_estimada,
            CASE
              WHEN m.status = 'ativa' AND m.data_fim_estimada < (NOW() AT TIME ZONE $1::text)::date
                THEN 'vencida'
              ELSE m.status
            END AS status,
            a.nome AS aluno_nome, p.nome AS plano_nome
     FROM matriculas m
     JOIN alunos a ON a.id = m.id_aluno
     JOIN planos p ON p.id = m.id_plano
     ORDER BY m.data_inicio DESC, m.id DESC`,
    [config.fusoNegocio]
  )
  return r.rows
}

type NovaMatricula = {
  idAluno: number
  idPlano: number
  dataInicio: string | null // null = hoje, no fuso da academia
  bloquearSeVigente: boolean
}

// ÚNICO lugar que calcula a data de fim: início + duração do plano, feito no banco.
// (31/01 + 1 mês = 28/02, e não 03/03 como acontece com setMonth do JavaScript.)
async function inserirMatricula(client: PoolClient, dados: NovaMatricula): Promise<Matricula> {
  const plano = await client.query<{ duracao_meses: number }>(
    'SELECT duracao_meses FROM planos WHERE id = $1',
    [dados.idPlano]
  )
  const duracao = plano.rows[0]?.duracao_meses
  if (duracao === undefined) throw erros.naoEncontrado('Plano não encontrado.')

  if (dados.bloquearSeVigente) {
    const vigente = await client.query(
      `SELECT 1 FROM matriculas
       WHERE id_aluno = $1 AND status = 'ativa'
         AND data_fim_estimada >= (NOW() AT TIME ZONE $2::text)::date
       LIMIT 1`,
      [dados.idAluno, config.fusoNegocio]
    )
    if (vigente.rows.length > 0) throw erros.conflito('Este aluno já possui uma matrícula ativa.')
  }

  const r = await client.query<Matricula>(
    `INSERT INTO matriculas (id_aluno, id_plano, data_inicio, data_fim_estimada, status)
     SELECT $1::int, $2::int, i.inicio, (i.inicio + make_interval(months => $3::int))::date, 'ativa'
     FROM (SELECT COALESCE($4::date, (NOW() AT TIME ZONE $5::text)::date) AS inicio) i
     RETURNING id, id_aluno, id_plano, data_inicio, data_fim_estimada, status`,
    [dados.idAluno, dados.idPlano, duracao, dados.dataInicio, config.fusoNegocio]
  )
  return primeiraLinha(r.rows)
}

// Matrícula criada pela equipe (desktop/mobile logados).
export function criar(idAluno: number, idPlano: number, dataInicio: string | null): Promise<Matricula> {
  return comTransacao(async (client) => {
    await client.query('SELECT id FROM alunos WHERE id = $1 FOR UPDATE', [idAluno])
    const aluno = await client.query<{ ativo: boolean }>('SELECT ativo FROM alunos WHERE id = $1', [
      idAluno
    ])
    const encontrado = aluno.rows[0]
    if (!encontrado) throw erros.naoEncontrado('Aluno não encontrado.')
    if (!encontrado.ativo) {
      throw erros.conflito('Aluno arquivado: restaure o cadastro antes de matricular.')
    }

    return inserirMatricula(client, { idAluno, idPlano, dataInicio, bloquearSeVigente: true })
  })
}

export function atualizarStatus(id: number, status: 'ativa' | 'inativa'): Promise<void> {
  return comTransacao(async (client) => {
    const matricula = await client.query<{ id: number; id_aluno: number; status: string }>(
      'SELECT id, id_aluno, status FROM matriculas WHERE id = $1',
      [id]
    )
    const encontrada = matricula.rows[0]
    if (!encontrada) throw erros.naoEncontrado('Matrícula não encontrada.')

    if (status === 'ativa') {
      await client.query('SELECT id FROM alunos WHERE id = $1 FOR UPDATE', [encontrada.id_aluno])

      const vigente = await client.query(
        `SELECT 1 FROM matriculas
         WHERE id_aluno = $1 AND id <> $2 AND status = 'ativa'
           AND data_fim_estimada >= (NOW() AT TIME ZONE $3::text)::date
         LIMIT 1`,
        [encontrada.id_aluno, id, config.fusoNegocio]
      )
      if (vigente.rows.length > 0) {
        throw erros.conflito('Este aluno já possui uma matrícula ativa.')
      }
    }

    await client.query('UPDATE matriculas SET status = $2 WHERE id = $1', [id, status])
  })
}

export async function excluir(id: number): Promise<void> {
  const r = await pool.query('DELETE FROM matriculas WHERE id = $1', [id])
  if (r.rowCount === 0) throw erros.naoEncontrado('Matrícula não encontrada.')
}

// Formulário público do site: cria (ou reaproveita) o aluno e a matrícula de uma vez.
// `plano` pode ser o id (rota nova) ou o nome (rota antiga da vitrine).
export function matricularDoSite(
  aluno: DadosAluno,
  plano: number | string
): Promise<{ alunoId: number; matriculaId: number; alunoExistente: boolean }> {
  return comTransacao(async (client) => {
    let idPlano: number
    if (typeof plano === 'number') {
      idPlano = plano
    } else {
      const achado = await client.query<{ id: number }>(
        'SELECT id FROM planos WHERE lower(nome) = lower($1::text) ORDER BY id LIMIT 1',
        [plano]
      )
      const linha = achado.rows[0]
      if (!linha) throw erros.naoEncontrado('Plano escolhido não existe.')
      idPlano = linha.id
    }

    const { id, existente } = await buscarOuCriarPublico(client, aluno)
    await client.query('SELECT id FROM alunos WHERE id = $1 FOR UPDATE', [id])
    const matricula = await inserirMatricula(client, {
      idAluno: id,
      idPlano,
      dataInicio: null,
      bloquearSeVigente: true
    })

    return { alunoId: id, matriculaId: matricula.id, alunoExistente: existente }
  })
}
