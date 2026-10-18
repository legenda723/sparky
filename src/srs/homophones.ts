// Слова, которые звучат одинаково (their / there). На слух их не отличить, поэтому у таких слов
// нет аудирования (SPEC → «Решения», 2026-10-19). Раз у слова-ответа нет созвучий, то и среди
// вариантов к его аудированию не может оказаться слова, которое звучит так же.

const GROUPS = [
  "their there they're",
  'to too two',
  "your you're",
  "its it's",
  'hear here',
  'know no',
  'knew new',
  'knows nose',
  'write right',
  'buy by bye',
  'see sea',
  'scene seen',
  'for four',
  'one won',
  'eye i',
  'flower flour',
  'weather whether',
  'peace piece',
  'meet meat',
  'week weak',
  'son sun',
  'ate eight',
  'hour our',
  'wear where',
  'which witch',
  'wood would',
  'plain plane',
  'pair pear',
  'bear bare',
  'deer dear',
  'hole whole',
  'night knight',
  'not knot',
  'made maid',
  'mail male',
  'sale sail',
  'road rode',
  'tail tale',
  'blue blew',
  'wait weight',
  'way weigh',
  'be bee',
  'aloud allowed',
  'cell sell',
  'cent scent sent',
  'die dye',
  'fair fare',
  'flu flew',
  'hair hare',
  'heal heel',
  'higher hire',
  'in inn',
  'morning mourning',
  'oh owe',
  'pain pane',
  'passed past',
  'poor pour',
  'rain reign',
  'real reel',
  'role roll',
  'sew so',
  'steal steel',
  'stair stare',
  'sum some',
  'threw through',
  'toe tow',
  'waist waste',
  'whine wine',
  'hi high',
  'board bored',
  'brake break',
  'cereal serial',
  'check cheque',
  'great grate',
  'guessed guest',
  'band banned',
  'berry bury',
  'mist missed',
  'nun none',
  'principal principle',
  'rap wrap',
  'rose rows',
  'tide tied',
]

/** Слово → номер его группы созвучий. */
const GROUP_OF = new Map<string, number>()
GROUPS.forEach((g, i) => g.split(' ').forEach((w) => GROUP_OF.set(w, i)))

/** Сравниваем без регистра, пробелов по краям, артикля и вида апострофа. */
function key(word: string): string {
  return word
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .trim()
    .replace(/^(a|an|the) /, '')
}

/** У слова есть созвучие — на слух его не узнать однозначно. */
export function hasHomophone(word: string): boolean {
  return GROUP_OF.has(key(word))
}
