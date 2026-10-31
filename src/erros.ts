export class ErroHttp extends Error {
  readonly status: number
  readonly codigo: string
  readonly detalhes: unknown

  constructor(status: number, codigo: string, mensagem: string, detalhes?: unknown) {
    super(mensagem)
    this.status = status
    this.codigo = codigo
    this.detalhes = detalhes
  }
}

// Fábricas de erro: as rotas só precisam fazer `throw erros.naoEncontrado(...)`.
export const erros = {
  validacao: (mensagem: string, detalhes?: unknown) =>
    new ErroHttp(400, 'VALIDACAO', mensagem, detalhes),
  naoAutenticado: (mensagem = 'Faça login para continuar.') =>
    new ErroHttp(401, 'NAO_AUTENTICADO', mensagem),
  semPermissao: (mensagem = 'Você não tem permissão para realizar esta ação.') =>
    new ErroHttp(403, 'SEM_PERMISSAO', mensagem),
  usuarioDesativado: () =>
    new ErroHttp(
      403,
      'USUARIO_DESATIVADO',
      'Este usuário está desativado. Fale com um administrador.'
    ),
  naoEncontrado: (mensagem = 'Registro não encontrado.') =>
    new ErroHttp(404, 'NAO_ENCONTRADO', mensagem),
  conflito: (mensagem: string) => new ErroHttp(409, 'CONFLITO', mensagem),
  muitasTentativas: (mensagem: string) => new ErroHttp(429, 'LIMITE_EXCEDIDO', mensagem)
}

// Código de erro do PostgreSQL (23505 = duplicado, 23503 = vínculo, ...)
export function codigoPg(erro: unknown): string | undefined {
  const codigo = (erro as { code?: unknown } | null)?.code
  return typeof codigo === 'string' ? codigo : undefined
}
