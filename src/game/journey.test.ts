import { describe, expect, it } from 'vitest'
import { addDays } from '../srs/day'
import { bandSides, dayLabel, intensity, monthCells, monthsFrom, monthTitle, type DayMark } from './calendar'
import { fillPhrase, PHRASES, phraseGroups, pickPhrase, TIME_MILESTONES, WORD_MILESTONES, type PhraseContext } from './phrases'
import { STREAK_MILESTONES } from './streak'

const mark = (p: Partial<DayMark> = {}): DayMark => ({ xp: 30, lessons: 1, done: true, frozen: false, ...p })

describe('календарь пути', () => {
  it('месяцы — от первого с уроками до текущего, через Новый год', () => {
    expect(monthsFrom('2026-11-15', '2027-02-03')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
    expect(monthsFrom(undefined, '2026-10-25')).toEqual(['2026-10'])
    expect(monthTitle('2026-10')).toBe('Октябрь 2026')
  })

  it('сетка — 6 недель с понедельника, чужие дни пустые', () => {
    const cells = monthCells('2026-10') // 1 октября 2026 — четверг
    expect(cells).toHaveLength(42)
    expect(cells.slice(0, 4)).toEqual([null, null, null, '2026-10-01'])
    expect(cells.filter(Boolean)).toHaveLength(31)
    expect(cells[3 + 30]).toBe('2026-10-31')
  })

  it('насыщенность — по доле дневной цели', () => {
    expect(intensity(10, 50)).toBe(1)
    expect(intensity(25, 50)).toBe(2)
    expect(intensity(50, 50)).toBe(3)
  })

  it('полоска стрика соединяет соседние дни с уроком или заморозкой и рвётся на краю недели', () => {
    const cells = monthCells('2026-10')
    // 4 (вс), 5 (пн), 6 (вт) — подряд, 6-е закрыто заморозкой; 8-го урок, 7-го нет.
    const marks = new Map([
      ['2026-10-04', mark()],
      ['2026-10-05', mark()],
      ['2026-10-06', mark({ done: false, lessons: 0, xp: 0, frozen: true })],
      ['2026-10-08', mark()],
    ])
    const at = (key: string) => bandSides(cells, cells.indexOf(key), marks)
    expect(at('2026-10-04')).toEqual({ left: false, right: false }) // воскресенье — конец строки
    expect(at('2026-10-05')).toEqual({ left: false, right: true })
    expect(at('2026-10-06')).toEqual({ left: true, right: false })
    expect(at('2026-10-08')).toEqual({ left: false, right: false })
    expect(at('2026-10-07')).toEqual({ left: false, right: false })
  })

  it('всплывашка дня', () => {
    expect(dayLabel('2026-10-23', '2026-10-25', mark({ xp: 45, lessons: 2 }))).toBe('23 окт · 45 XP · 2 урока')
    expect(dayLabel('2026-05-01', '2026-10-25', mark({ xp: 12, lessons: 0 }))).toBe('1 мая · 12 XP · тренировка')
    expect(dayLabel('2026-10-24', '2026-10-25', mark({ xp: 0, lessons: 0, done: false, frozen: true }))).toBe('24 окт · заморозка ❄️')
    expect(dayLabel('2026-10-25', '2026-10-25', undefined)).toBe('Сегодня · пока без занятий')
    expect(dayLabel('2026-10-20', '2026-10-25', undefined)).toBe('20 окт · без занятий')
  })
})

const base: PhraseContext = { today: '2026-10-25', firstDay: '2026-10-25', streak: 1, words: 3, activeDays: 1 }

describe('фраза «Твой путь»', () => {
  it('на каждую веху — 10 разных вариантов', () => {
    const groups = [
      ...TIME_MILESTONES.map((m) => `t${m}`),
      't0',
      ...STREAK_MILESTONES.map((m) => `s${m}`),
      ...WORD_MILESTONES.map((m) => `w${m}`),
      'start',
    ]
    for (const g of groups) {
      expect(PHRASES[g], g).toHaveLength(10)
      expect(new Set(PHRASES[g]).size, g).toBe(10)
    }
    const all = Object.values(PHRASES).flat()
    expect(new Set(all).size).toBe(all.length)
  })

  it('только правда: без «носителя», «свободно», процентов и уровня без оговорки', () => {
    for (const p of Object.values(PHRASES).flat()) {
      expect(p).not.toMatch(/носител|свободно|%|бегло/i)
      if (/\b[AB][12]\b/.test(p)) expect(p, p).toMatch(/по размеру словаря/i)
    }
  })

  it('вехи: самая высокая пройденная в каждом ряду; стрик 0 и меньше 10 слов — не вехи', () => {
    expect(phraseGroups({ ...base, firstDay: undefined }).all).toEqual(['zero'])
    expect(phraseGroups(base).all).toEqual(['t0'])
    expect(phraseGroups({ ...base, firstDay: '2026-10-24', streak: 2 }).all).toEqual(['start'])
    expect(phraseGroups({ ...base, firstDay: '2026-09-01', streak: 0, words: 120 }).all).toEqual(['t30', 'w100'])
    expect(phraseGroups({ ...base, firstDay: '2024-01-01', streak: 400, words: 6000 }).all).toEqual(['t730', 's365', 'w5000'])
  })

  it('свежая веха (сегодня ровно неделя или ровно 7 дней подряд) — первой', () => {
    const week = { ...base, firstDay: addDays(base.today, -7), streak: 7, words: 60, activeDays: 7 }
    expect(phraseGroups(week).fresh).toEqual(['t7', 's7'])
    expect(['t7', 's7']).toContain(pickPhrase(week).group)
    // Через день веха уже не свежая — фразы снова по очереди из всех рядов.
    expect(phraseGroups({ ...week, today: addDays(week.today, 1), streak: 8 }).fresh).toEqual([])
  })

  it('меняется раз в день и подряд не повторяется; все подстановки заполнены', () => {
    let prev = ''
    const seen = new Set<string>()
    for (let i = 0; i < 400; i++) {
      const today = addDays('2026-01-01', i)
      const c: PhraseContext = { today, firstDay: '2026-01-01', streak: i + 1, words: i * 4, activeDays: i + 1 }
      const p = pickPhrase(c)
      expect(p.text, today).not.toBe(prev)
      expect(p.text).not.toMatch(/[{}]/)
      expect(pickPhrase(c)).toEqual(p) // в течение дня — та же
      prev = p.text
      seen.add(p.text)
    }
    expect(seen.size).toBeGreaterThan(150)
  })

  it('числа — с правильными окончаниями', () => {
    const c = { ...base, firstDay: '2023-10-25', streak: 3, words: 21, activeDays: 22 }
    expect(fillPhrase('{words} · {streak} · {active} · {years}', c)).toBe('21 слово · 3 дня · 22 дня · 3 года')
    expect(fillPhrase('{words} · {streak} · {years}', { ...c, words: 5, streak: 11, firstDay: '2021-10-25' })).toBe('5 слов · 11 дней · 5 лет')
  })
})
