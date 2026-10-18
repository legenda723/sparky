// Стенд движения в витрине: все окна на одной странице (DESIGN.md → «Движение»). Переход в колоду — во вкладке «Слова».
import { useRef, useState } from 'react'
import { Popover } from '../ui/Popover'
import { Button } from '../ui/Button'
import { FormSheet } from '../ui/FormSheet'
import { Sheet } from '../ui/Sheet'
import { TextField } from '../ui/TextField'
import { useToast } from '../ui/Toast'

export function MotionLab() {
  const [sheet, setSheet] = useState(false)
  const [form, setForm] = useState(false)
  const [pop, setPop] = useState(false)
  const popAnchor = useRef<HTMLDivElement>(null)
  const toast = useToast()

  return (
    <section className="mb-8 flex flex-col gap-3">
      <h2 className="m-0 text-heading font-black text-text">Движение</h2>
      <p className="m-0 text-small font-semibold text-muted">
        Открой каждое окно, потяни вниз медленно и быстро, поймай пальцем на ходу. Колода — во вкладке «Слова»: въезжает справа, назад — смахнуть вправо.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => setSheet(true)}>
          Окно
        </Button>
        <Button variant="secondary" onClick={() => setForm(true)}>
          Лист
        </Button>
        <Button variant="secondary" onClick={() => toast({ message: 'Слово сохранено' })}>
          Тост
        </Button>
        <div ref={popAnchor}>
          <Button block variant="secondary" onClick={() => setPop(true)}>
            Всплывашка
          </Button>
        </div>
      </div>
      <Popover open={pop} onClose={() => setPop(false)} anchorRef={popAnchor}>
        <p className="m-0 text-heading font-black text-text">Всплывашка</p>
        <p className="m-0 mt-1 text-small font-semibold text-muted">Закрывается касанием мимо.</p>
      </Popover>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Удалить колоду «Еда»?" text="40 слов спрячутся. Отменить можно в течение 5 секунд.">
        <Button block variant="danger" onClick={() => setSheet(false)}>
          Удалить
        </Button>
        <Button block variant="secondary" onClick={() => setSheet(false)}>
          Отмена
        </Button>
      </Sheet>
      <FormSheet open={form} title="Новое слово" onCancel={() => setForm(false)} onDone={() => setForm(false)}>
        <TextField label="Слово" defaultValue="apple" />
        <TextField label="Перевод" defaultValue="яблоко" />
        {Array.from({ length: 12 }, (_, i) => (
          <p key={i} className="m-0 text-body font-semibold text-muted">
            Строка {i + 1}: прокрути вниз и обратно вверх, потом потяни лист вниз.
          </p>
        ))}
      </FormSheet>
    </section>
  )
}
