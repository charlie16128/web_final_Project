const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000

export function toTaipeiInputValue(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Date(date.getTime() + TAIPEI_OFFSET_MS).toISOString().slice(0, 16)
}

export function taipeiInputToIso(value) {
  if (!value) {
    return ''
  }

  const normalized = String(value).trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(normalized)
  if (!match) {
    return normalized
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6] || 0)
  const millisecond = Number((match[7] || '0').padEnd(3, '0'))
  const localCheck = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond))

  if (
    localCheck.getUTCFullYear() !== year ||
    localCheck.getUTCMonth() !== month - 1 ||
    localCheck.getUTCDate() !== day ||
    localCheck.getUTCHours() !== hour ||
    localCheck.getUTCMinutes() !== minute ||
    localCheck.getUTCSeconds() !== second ||
    localCheck.getUTCMilliseconds() !== millisecond
  ) {
    return normalized
  }

  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second, millisecond)).toISOString()
}