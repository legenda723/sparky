import { Download, Info, Palette, ShieldAlert, ShieldCheck, Smartphone, Sparkles, Volume2 } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { useStorageStatus, type StorageStatus } from '../app/install'
import { getPendingUpdate, subscribePendingUpdate } from '../app/updates'
import { setPref, usePrefs, type ThemePref } from '../app/prefs'
import { navigate } from '../app/routes'
import { Screen } from '../shell/Screen'
import { ChoiceChips } from '../ui/ChoiceChips'
import { ListRow } from '../ui/ListRow'
import { Switch } from '../ui/Switch'

const STORAGE_TEXT: Record<StorageStatus, { title: string; subtitle: string }> = {
  protected: { title: 'Хранилище: защищено', subtitle: 'iPhone не сотрёт слова при нехватке места' },
  unprotected: { title: 'Хранилище: не защищено', subtitle: 'Нажми, чтобы попросить защиту' },
  unknown: { title: 'Хранилище: проверяю…', subtitle: 'Защита от стирания при нехватке места' },
}

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'Как в системе' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
]

export function ProfileScreen() {
  const prefs = usePrefs()
  const [storage, requestStorage] = useStorageStatus()
  const applyUpdate = useSyncExternalStore(subscribePendingUpdate, getPendingUpdate)
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

      <section className="-mx-4 mb-6 border-t-2 border-border">
        <ListRow
          icon={
            storage === 'protected' ? (
              <ShieldCheck size={24} className="text-primary" />
            ) : (
              <ShieldAlert size={24} className="text-streak" />
            )
          }
          title={STORAGE_TEXT[storage].title}
          subtitle={STORAGE_TEXT[storage].subtitle}
          onClick={storage === 'unprotected' ? requestStorage : undefined}
        />
        <ListRow
          icon={<Info size={24} className="text-muted" />}
          title="Версия"
          right={<span className="text-small font-bold text-muted">{__APP_VERSION__}</span>}
        />
        {applyUpdate && (
          <ListRow
            icon={<Download size={24} className="text-primary" />}
            title="Обновить Спарки"
            subtitle="Новая версия уже скачана"
            onClick={applyUpdate}
          />
        )}
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
