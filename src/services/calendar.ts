// BSUIR Calendar Week Calculation (1-to-1 with Kotlin getBsuirWeekForCalendarDay)

export function getBsuirWeekForCalendarDay(selectedDayIndex: number): { dow: number; weekNum: number; date: Date } {
  const cal = new Date()
  cal.setDate(cal.getDate() - 7 + selectedDayIndex)

  let dow = cal.getDay()
  if (dow === 0) dow = 7 // Sunday -> 7, Monday -> 1

  const year = cal.getFullYear()
  const month = cal.getMonth() // 0-based
  const sep1Year = month < 7 ? year - 1 : year // August is 7

  const sep1Cal = new Date(sep1Year, 8, 1, 12, 0, 0, 0) // September is 8
  let sep1Dow = sep1Cal.getDay()
  if (sep1Dow === 0) sep1Dow = 7
  sep1Cal.setDate(sep1Cal.getDate() - (sep1Dow - 1))

  const targetMonday = new Date(cal)
  targetMonday.setHours(12, 0, 0, 0)
  targetMonday.setDate(targetMonday.getDate() - (dow - 1))

  const diffMillis = targetMonday.getTime() - sep1Cal.getTime()
  const diffWeeks = Math.floor(diffMillis / (7 * 24 * 60 * 60 * 1000))
  const weekNum = (((diffWeeks % 4) + 4) % 4) + 1

  return { dow, weekNum, date: cal }
}

export function formatDayDate(date: Date): { dayName: string; dayNumber: string; monthName: string } {
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
  return {
    dayName: days[date.getDay()],
    dayNumber: date.getDate().toString(),
    monthName: months[date.getMonth()]
  }
}
