export function parseTimeToMinutes(input: string): number {
  if (!input) return 24 * 60

  const s = input.trim().toUpperCase()

  const ampmMatch = s.match(/\b(AM|PM)\b/)
  const hasAmPm = !!ampmMatch
  const ampm = ampmMatch?.[1] as "AM" | "PM" | undefined

  const hmMatch = s.match(/(\d{1,2})(?::(\d{2}))?/)
  if (!hmMatch) return 24 * 60

  let hour = parseInt(hmMatch[1], 10)
  const minute = hmMatch[2] ? parseInt(hmMatch[2], 10) : 0
  if (Number.isNaN(hour) || Number.isNaN(minute)) return 24 * 60
  if (minute < 0 || minute > 59) return 24 * 60

  if (hasAmPm) {
    if (ampm === "AM") {
      if (hour === 12) hour = 0
    } else if (ampm === "PM") {
      if (hour !== 12) hour += 12
    }
    if (hour < 0 || hour > 23) return 24 * 60
    return hour * 60 + minute
  }

  if (hour < 0 || hour > 23) return 24 * 60
  return hour * 60 + minute
}
