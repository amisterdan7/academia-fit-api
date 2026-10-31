import { randomBytes, scrypt, timingSafeEqual } from 'crypto'

// Mesmo formato do aplicativo desktop ("<salt em hex>:<hash em hex>", scrypt de 64 bytes):
// usuários criados por um funcionam no outro.
const TAMANHO_CHAVE = 64

// Hash que nunca confere: usado quando o usuário não existe, para o tempo de resposta
// ser igual e não revelar quais logins existem.
export const HASH_INEXISTENTE = `${'00'.repeat(16)}:${'00'.repeat(TAMANHO_CHAVE)}`

function derivarChave(senha: string, salt: Buffer, tamanho: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(senha, salt, tamanho, (erro, chave) => (erro ? reject(erro) : resolve(chave)))
  })
}

export async function gerarHash(senha: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await derivarChave(senha, salt, TAMANHO_CHAVE)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export async function conferirSenha(senha: string, armazenado: string): Promise<boolean> {
  const [saltHex, hashHex] = armazenado.split(':')
  if (!saltHex || !hashHex) return false

  const esperado = Buffer.from(hashHex, 'hex')
  const calculado = await derivarChave(senha, Buffer.from(saltHex, 'hex'), esperado.length)
  return timingSafeEqual(calculado, esperado)
}
