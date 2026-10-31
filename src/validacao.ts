import { z } from 'zod'
import { dataValida, hojeNegocio } from './datas'
import { erros } from './erros'

// ---------------------------------------------------------------------------
// Peças reutilizáveis
// ---------------------------------------------------------------------------
const LOGIN = /^[a-z0-9._-]{3,30}$/

const nomePessoa = z
  .string()
  .trim()
  .min(3, 'Informe o nome completo.')
  .max(100, 'O nome deve ter no máximo 100 caracteres.')

const dataISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida. Use o formato AAAA-MM-DD.')
  .refine(dataValida, 'Data inválida.')

const nascimento = dataISO
  .refine((data) => data < hojeNegocio(), 'A data de nascimento não pode ser hoje nem no futuro.')
  .refine((data) => data >= '1900-01-01', 'Data de nascimento inválida.')

// Aceita máscara: "(84) 99999-0000", "84999990000", "+55 84 99999-0000"
function telefoneValido(texto: string): boolean {
  if (!/^[\d\s()+-]+$/.test(texto)) return false
  const digitos = texto.replace(/\D/g, '').length
  return digitos >= 10 && digitos <= 13
}

const telefone = z
  .string()
  .trim()
  .max(20, 'O telefone deve ter no máximo 20 caracteres.')
  .refine(
    (valor) => valor === '' || telefoneValido(valor),
    'Telefone inválido. Use DDD, por exemplo (84) 99999-0000.'
  )
  .nullish()
  .transform((valor) => (valor ? valor : null))

const idSchema = z
  .number()
  .int('Identificador inválido.')
  .positive('Identificador inválido.')

const senhaNova = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres.')
  .max(128, 'A senha deve ter no máximo 128 caracteres.')

function opcoes<const T extends readonly string[]>(validos: T, mensagem: string) {
  return z
    .string()
    .refine((valor) => validos.includes(valor), mensagem)
    .transform((valor) => valor as T[number])
}

// ---------------------------------------------------------------------------
// Esquemas por recurso
// ---------------------------------------------------------------------------
export const loginSchema = z.object({
  login: z.string().trim().toLowerCase().min(1, 'Informe o usuário.'),
  senha: z.string().min(1, 'Informe a senha.').max(200, 'Senha inválida.')
})

export const trocarSenhaSchema = z.object({
  senha_atual: z.string().min(1, 'Informe a senha atual.').max(200, 'Senha inválida.'),
  nova_senha: senhaNova
})

export const alunoSchema = z.object({
  nome: nomePessoa,
  data_nascimento: nascimento,
  telefone
})

export const ativoSchema = z.object({ ativo: z.boolean() })

const recurso = z.object({
  descricao: z
    .string()
    .trim()
    .min(1, 'Descreva o benefício.')
    .max(120, 'Cada benefício deve ter no máximo 120 caracteres.')
})

export const planoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Informe o nome do plano.')
    .max(50, 'O nome do plano deve ter no máximo 50 caracteres.'),
  preco: z.number().min(0, 'O preço não pode ser negativo.').max(100000, 'Preço inválido.'),
  duracao_meses: z
    .number()
    .int('A duração deve ser em meses inteiros.')
    .min(1, 'A duração mínima é de 1 mês.')
    .max(60, 'A duração máxima é de 60 meses.'),
  descricao: z
    .string()
    .trim()
    .max(500, 'A descrição deve ter no máximo 500 caracteres.')
    .nullish()
    .transform((valor) => valor ?? ''),
  destaque: z
    .boolean()
    .nullish()
    .transform((valor) => valor ?? false),
  recursos: z
    .array(recurso)
    .max(30, 'No máximo 30 benefícios por plano.')
    .nullish()
    .transform((valor) => valor ?? [])
})

export const matriculaSchema = z.object({
  id_aluno: idSchema,
  id_plano: idSchema,
  data_inicio: dataISO.nullish().transform((valor) => valor ?? null)
})

export const statusMatriculaSchema = z.object({
  status: opcoes(['ativa', 'inativa'] as const, 'Status inválido. Use "ativa" ou "inativa".')
})

export const novoUsuarioSchema = z.object({
  nome: nomePessoa,
  login: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      LOGIN,
      'O usuário deve ter de 3 a 30 caracteres: letras, números, ponto, hífen ou sublinhado.'
    ),
  senha: senhaNova,
  perfil: opcoes(['admin', 'recepcao'] as const, 'Perfil inválido. Use "admin" ou "recepcao".')
})

export const redefinirSenhaSchema = z.object({ senha: senhaNova })

// Formulário público do site (rota nova): o plano vem por id.
export const preMatriculaSchema = z.object({
  nome: nomePessoa,
  data_nascimento: nascimento,
  telefone,
  id_plano: idSchema
})

// Rota antiga POST /matriculas, que a vitrine usa hoje: o plano vem pelo nome.
export const matriculaLegadaSchema = z.object({
  nome: nomePessoa,
  data_nascimento: nascimento,
  telefone,
  nome_plano: z
    .string()
    .trim()
    .min(1, 'Informe o plano.')
    .max(50, 'O nome do plano deve ter no máximo 50 caracteres.')
})

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------
export function validar<T extends z.ZodType>(schema: T, dados: unknown): z.output<T> {
  const resultado = schema.safeParse(dados ?? {})

  if (!resultado.success) {
    const detalhes = resultado.error.issues.map((problema) => {
      const campo = problema.path.map(String).join('.')
      const mensagem =
        problema.code === 'invalid_type'
          ? `Campo obrigatório ou em formato inválido: ${campo || 'corpo da requisição'}.`
          : problema.message
      return { campo, mensagem }
    })
    throw erros.validacao(detalhes[0]?.mensagem ?? 'Dados inválidos.', detalhes)
  }

  return resultado.data as z.output<T>
}

// Lê um id da URL (/alunos/:id) e garante que é um inteiro positivo.
// (No Express 5 os parâmetros de rota podem ser texto ou lista de textos, por isso o `typeof`.)
export function idDe(
  parametros: Record<string, string | string[] | undefined>,
  nome = 'id'
): number {
  const bruto = parametros[nome]
  const id = typeof bruto === 'string' ? Number(bruto) : Number.NaN
  if (!Number.isInteger(id) || id <= 0) throw erros.validacao('Identificador inválido.')
  return id
}
