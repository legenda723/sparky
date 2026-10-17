import { Palette, Smartphone, Sparkles, Volume2 } from 'lucide-react'
import { setPref, usePrefs, type ThemePref } from '../app/prefs'
import { navigate } from '../app/routes'
import { Screen } from '../shell/Screen'
import { ChoiceChips } from '../ui/ChoiceChips'
import { ListRow } from '../ui/ListRow'
import { Switch } from '../ui/Switch'

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'Как в системе' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
]

export function ProfileScreen() {
  const prefs = usePrefs()
  return (
    <Screen title="Профиль">
      <section className="mb-6">
        <h2 className="m-0 mb-3 flex items-center gap-2 text-heading font-black text-text">
          <Palette size={22} className="text-gem" /> Тема
        </h2>
        <ChoiceChips
          label="Тема"
          options={THEME_OPTIONS}
          value={prefs.theme}
          onChange={(v) => setPref('theme', v)}
        />
      </section>

      <section className="-mx-4 mb-6 border-t-2 border-border">
        <ListRow
          icon={<Volume2 size={24} className="text-info" />}
          title="Звуки"
          right={<Switch label="Звуки" checked={prefs.sound} onChange={(v) => setPref('sound', v)} />}
        />
        <ListRow
          icon={<Smartphone size={24} className="text-streak" />}
          title="Вибрация"
          subtitle="Если телефон поддерживает"
          right={<Switch label="Вибрация" checked={prefs.haptics} onChange={(v) => setPref('haptics', v)} />}
        />
      </section>

      <p className="m-0 mb-2 text-small font-semibold text-muted">
        Скоро здесь будут уровень, достижения, магазин и бэкап.
      </p>

      <section className="-mx-4 border-t-2 border-border">
        <ListRow
          icon={<Sparkles size={22} className="text-muted" />}
          title="Витрина компонентов"
          subtitle="Для проверки дизайна"
          onClick={() => navigate('dev')}
        />
      </section>
    </Screen>
  )
}
