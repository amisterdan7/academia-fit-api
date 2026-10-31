import type { PoolClient } from 'pg'
import { comTransacao, pool, primeiraLinha } from '../db'
import { codigoPg, erros } from '../erros'

export type Recurso = { descricao: string }

export type Plano = {
  id: number
  nome: string
  preco: number
  duracao_meses: number
  descricao: string | null
  destaque: boolean
  recursos: Recurso[]
}

export type DadosPlano = {
  nome: string
  preco: number
  duracao_meses: number
  descricao: string
  destaque: boolean
  recursos: Recurso[]
}

// preco::float8 entrega número (o pg devolveria NUMERIC como texto).
const BASE = `
  SELECT p.id, p.nome, p.preco::float8 AS preco, p.duracao_meses, p.descricao, p.destaque,
         COALESCE(
           json_agg(json_build_object('descricao', pr.descricao) ORDER BY pr.ordem)
             FILTER (WHERE pr.descricao IS NOT NULL),
           '[]'::json
         ) AS recursos
  FROM planos p
  LEFT JOIN plano_recursos pr ON pr.id_plano = p.id
`

function consulta(where = ''): string {
  return `${BASE} ${where} GROUP BY p.id ORDER BY p.preco DESC, p.id`
}

export async function listar(): Promise<Plano[]> {
  const r = await pool.query<Plano>(consulta())
  return r.rows
}

// Formato antigo, usado pela vitrine hoje: "features" é uma lista de textos.
// Não mexa no formato até o site migrar para /v1/planos.
export async function listarLegado(): Promise<unknown[]> {
  const r = await pool.query(`
    SELECT p.id, p.nome, p.preco, p.duracao_meses, p.descricao, p.destaque,
           COALESCE(
             json_agg(pr.descricao ORDER BY pr.ordem) FILTER (WHERE pr.descricao IS NOT NULL),
             '[]'
           ) AS features
    FROM planos p
    LEFT JOIN plano_recursos pr ON p.id = pr.id_plano
    GROUP BY p.id
    ORDER BY p.preco DESC
  `)
  return r.rows
}

async function obter(client: PoolClient, id: number): Promise<Plano> {
  const r = await client.query<Plano>(consulta('WHERE p.id = $1'), [id])
  const plano = r.rows[0]
  if (!plano) throw erros.naoEncontrado('Plano não encontrado.')
  return plano
}

async function gravarRecursos(
  client: PoolClient,
  idPlano: number,
  recursos: Recurso[]
): Promise<void> {
  for (const [indice, recurso] of recursos.entries()) {
    await client.query(
      'INSERT INTO plano_recursos (id_plano, descricao, ordem) VALUES ($1, $2, $3)',
      [idPlano, recurso.descricao, indice + 1]
    )
  }
}

export function criar(dados: DadosPlano): Promise<Plano> {
  return comTransacao(async (client) => {
    const r = await client.query<{ id: number }>(
      `INSERT INTO planos (nome, preco, duracao_meses, descricao, destaque)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [dados.nome, dados.preco, dados.duracao_meses, dados.descricao, dados.destaque]
    )
    const { id } = primeiraLinha(r.rows)
    await gravarRecursos(client, id, dados.recursos)
    return obter(client, id)
  })
}

export function atualizar(id: number, dados: DadosPlano): Promise<Plano> {
  return comTransacao(async (client) => {
    const r = await client.query(
      `UPDATE planos
       SET nome = $2, preco = $3, duracao_meses = $4, descricao = $5, destaque = $6
       WHERE id = $1`,
      [id, dados.nome, dados.preco, dados.duracao_meses, dados.descricao, dados.destaque]
    )
    if (r.rowCount === 0) throw erros.naoEncontrado('Plano não encontrado.')

    await client.query('DELETE FROM plano_recursos WHERE id_plano = $1', [id])
    await gravarRecursos(client, id, dados.recursos)
    return obter(client, id)
  })
}

export function excluir(id: number): Promise<void> {
  return comTransacao(async (client) => {
    try {
      await client.query('DELETE FROM plano_recursos WHERE id_plano = $1', [id])
      const r = await client.query('DELETE FROM planos WHERE id = $1', [id])
      if (r.rowCount === 0) throw erros.naoEncontrado('Plano não encontrado.')
    } catch (erro) {
      if (codigoPg(erro) === '23503') {
        throw erros.conflito('Não é possível excluir: existem matrículas neste plano.')
      }
      throw erro
    }
  })
}
