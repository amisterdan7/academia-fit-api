import { config } from './config'

// "Hoje" no fuso da academia (e não no do servidor, que costuma ser UTC), em AAAA-MM-DD.
export function hojeNegocio(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: config.fusoNegocio,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(agora)

  const valor = (tipo: string): string => partes.find((p) => p.type === tipo)?.value ?? ''
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}

// Confere formato E existência real (rejeita 2026-02-31, por exemplo).
export function dataValida(texto: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto)
  if (!m) return false

  const ano = Number(m[1])
  const mes = Number(m[2])
  const dia = Number(m[3])
  const data = new Date(Date.UTC(ano, mes - 1, dia))

  return (
    data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
  )
}
