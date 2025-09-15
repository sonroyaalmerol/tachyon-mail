export function getMonthCellsWithNulls(daysInMonth: number, firstDay: number) {
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells.map((day, idx) => ({ idx, day }))
}

export function getWeekIndexForDay(idx: number, columns = 7) {
  if (idx < 0) return 0
  return Math.floor(idx / columns)
}

export function getVisibleCellsForMode({
  allCells,
  mode,
  currentIndex,
  columns = 7,
}: {
  allCells: { idx: number; day: number | null }[]
  mode: "month" | "week"
  currentIndex: number
  columns?: number
}) {
  if (mode === "month") return allCells
  const weekIdx = getWeekIndexForDay(currentIndex, columns)
  const start = weekIdx * columns
  const end = start + columns
  return allCells.slice(start, end)
}

export function moveIndexByArrow({
  key,
  from,
  columns,
  max,
}: {
  key: string
  from: number
  columns: number
  max: number
}) {
  let next = from
  if (key === "ArrowLeft") next = Math.max(0, from - 1)
  else if (key === "ArrowRight") next = Math.min(max - 1, from + 1)
  else if (key === "ArrowUp") next = Math.max(0, from - columns)
  else if (key === "ArrowDown") next = Math.min(max - 1, from + columns)
  return next
}
