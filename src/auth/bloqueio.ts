// Bloqueio por usuário após várias senhas erradas (além do limite por IP nas rotas).
// Fica na memória do processo: reinicia com a API e não é compartilhado entre instâncias.
const MAX_FALHAS = 5
const BLOQUEIO_MS = 60_000
const JANELA_MS = 15 * 60_000
const LIMITE_DO_MAPA = 5000

type Registro = { falhas: number; bloqueadoAte: number; ultima: number }
const registros = new Map<string, Registro>()

export function chaveBloqueio(login: string, ip: string): string {
  return `${login.trim().toLowerCase()}:${ip.trim()}`
}

// Segundos restantes de bloqueio (0 = liberado).
export function segundosDeBloqueio(chave: string, agora: number = Date.now()): number {
  const registro = registros.get(chave)
  if (!registro || registro.bloqueadoAte <= agora) return 0
  return Math.ceil((registro.bloqueadoAte - agora) / 1000)
}

export function registrarFalha(chave: string, agora: number = Date.now()): void {
  if (registros.size >= LIMITE_DO_MAPA) limpar(agora)

  const registro = registros.get(chave) ?? { falhas: 0, bloqueadoAte: 0, ultima: agora }
  if (agora - registro.ultima > JANELA_MS) registro.falhas = 0

  registro.falhas += 1
  registro.ultima = agora
  if (registro.falhas >= MAX_FALHAS) {
    registro.falhas = 0
    registro.bloqueadoAte = agora + BLOQUEIO_MS
  }
  registros.set(chave, registro)
}

export function limparFalhas(chave: string): void {
  registros.delete(chave)
}

// Evita que o mapa cresça sem limite se alguém testar milhares de logins diferentes.
function limpar(agora: number): void {
  for (const [chave, registro] of registros) {
    if (registro.bloqueadoAte <= agora && agora - registro.ultima > JANELA_MS) {
      registros.delete(chave)
    }
  }
  while (registros.size >= LIMITE_DO_MAPA) {
    const maisAntiga = registros.keys().next().value
    if (maisAntiga === undefined) break
    registros.delete(maisAntiga)
  }
}
