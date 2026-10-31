export type Perfil = 'admin' | 'recepcao'

// ---------------------------------------------------------------------------
// PERMISSÕES — único lugar onde se decide "quem pode o quê".
// Os nomes são os mesmos do aplicativo desktop (ex.: 'alunos:excluir').
// Para liberar ou bloquear algo para a recepção, é só mexer nesta lista.
// ---------------------------------------------------------------------------
const PERMISSOES: Record<Perfil, readonly string[] | '*'> = {
  admin: '*',
  recepcao: [
    'alunos:listar',
    'alunos:criar',
    'alunos:atualizar',
    'planos:listar',
    'matriculas:listar',
    'matriculas:criar'
  ]
}

export function temPermissao(perfil: Perfil, acao: string): boolean {
  const lista = PERMISSOES[perfil]
  return lista === '*' || lista.includes(acao)
}

export function permissoesDe(perfil: Perfil): string[] {
  const lista = PERMISSOES[perfil]
  return lista === '*' ? ['*'] : [...lista]
}
