/**
 * Ficheiro de calendário (.ics) gerado no navegador para "Adicionar ao calendário".
 * Inclui o fuso horário (Lisboa ou Açores) para a hora ficar certa em qualquer aplicação.
 */
import type { Candidatura, Lar } from '@/types'
import { dataLocal, telHref } from './text'

const pad = (n: number) => String(n).padStart(2, '0')
const local = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Dobra linhas longas (RFC 5545: máx. 75 octetos; usamos 60 caracteres por causa dos acentos). */
function fold(line: string): string {
  if (line.length <= 60) return line
  const parts: string[] = []
  let rest = line
  parts.push(rest.slice(0, 60))
  rest = rest.slice(60)
  while (rest.length > 59) {
    parts.push(' ' + rest.slice(0, 59))
    rest = rest.slice(59)
  }
  if (rest) parts.push(' ' + rest)
  return parts.join('\r\n')
}

const VTIMEZONE: Record<string, string[]> = {
  'Europe/Lisbon': [
    'BEGIN:VTIMEZONE', 'TZID:Europe/Lisbon',
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0000', 'TZOFFSETTO:+0100', 'TZNAME:WEST', 'DTSTART:19700329T010000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0000', 'TZNAME:WET', 'DTSTART:19701025T020000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
    'END:VTIMEZONE',
  ],
  'Atlantic/Azores': [
    'BEGIN:VTIMEZONE', 'TZID:Atlantic/Azores',
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0100', 'TZOFFSETTO:+0000', 'TZNAME:+00', 'DTSTART:19700329T000000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:+0000', 'TZOFFSETTO:-0100', 'TZNAME:-01', 'DTSTART:19701025T010000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
    'END:VTIMEZONE',
  ],
}

export function visitaICS(c: Candidatura, lar: Lar, guiaUrl: string): string | null {
  if (!c.visita) return null
  const tz = lar.distrito === 'Açores' ? 'Atlantic/Azores' : 'Europe/Lisbon'
  const inicio = dataLocal(c.visita.data, c.visita.hora)
  const fim = new Date(inicio.getTime() + 60 * 60_000)
  const morada = [lar.morada, `${lar.codigoPostal} ${lar.localidade}`.trim()].filter(Boolean).join(', ')
  const descricao = [
    `Visita às instalações de ${lar.nome} (pedido para ${c.perfil.nome}).`,
    c.visita.estado === 'confirmada' ? 'Visita confirmada pela instituição.' : 'A aguardar confirmação da instituição.',
    `Contacto: ${lar.telefone} (${telHref(lar.telefone)}) · ${lar.email}`,
    `O que observar e perguntar: ${guiaUrl}`,
  ].join('\n')
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EncontraLar//Visita//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...VTIMEZONE[tz]!,
    'BEGIN:VEVENT',
    `UID:visita-${c.id}-${c.visita.data}@encontralar.pt`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART;TZID=${tz}:${local(inicio)}`,
    `DTEND;TZID=${tz}:${local(fim)}`,
    `SUMMARY:${esc(`Visita a ${lar.nome}`)}`,
    `LOCATION:${esc(morada)}`,
    `GEO:${lar.lat.toFixed(5)};${lar.lng.toFixed(5)}`,
    `DESCRIPTION:${esc(descricao)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-P1D',
    `DESCRIPTION:${esc(`Amanhã: visita a ${lar.nome} às ${c.visita.hora}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return linhas.map(fold).join('\r\n') + '\r\n'
}

export function descarregarFicheiro(nome: string, conteudo: string, tipo: string) {
  const blob = new Blob([conteudo], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)

/** Descarrega o .ics da visita. Devolve false se não houver visita. */
export function descarregarVisita(c: Candidatura, lar: Lar): boolean {
  const guia = `${window.location.origin}${window.location.pathname}#/guia#visita`
  const ics = visitaICS(c, lar, guia)
  if (!ics) return false
  descarregarFicheiro(`visita-${slug(lar.nome)}.ics`, ics, 'text/calendar;charset=utf-8')
  return true
}
