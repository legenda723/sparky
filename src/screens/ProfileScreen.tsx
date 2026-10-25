import { ArchiveRestore, CloudUpload, Download, Info, Palette, ShieldAlert, ShieldCheck, Sparkles, Volume2 } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { useStorageStatus, type StorageStatus } from '../app/install'
import { getPendingUpdate, subscribePendingUpdate } from '../app/updates'
import { setPref, usePrefs, type ThemePref } from '../app/prefs'
import { navigate } from '../app/routes'
import { BackupNudge } from '../backup/BackupNudge'
import { SaveBackupSheet, useBackupStatus, useRestore } from '../backup/BackupSheets'
import { backupAgeText, isBackupStale } from '../backup/reminder'
import { changeTheme } from '../app/theme'
import { ProfileGameSection } from '../profile/ProfileGame'
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
      <ProfileGameSection />

      <section className="mb-6">
        <h2 className="m-0 mb-3 flex items-center gap-2 text-heading font-black text-text">
          <Palette size={22} className="text-gem" /> Тема
        </h2>
        <ChoiceChips
          label="Тема"
          options={THEME_OPTIONS}
          value={prefs.theme}
          onChange={changeTheme}
        />
      </section>

      <section className="-mx-4 mb-6 border-t-2 border-border">
        <ListRow
          icon={<Volume2 size={24} className="text-info" />}
          title="Звук"
          right={<Switch label="Звук" checked={prefs.sound} onChange={(v) => setPref('sound', v)} />}
        />
      </section>

      <BackupSection />

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
        Скоро здесь будет магазин: темы и наряды для Спарки — за уровни и достижения.
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

/** Бэкап (SPEC → 7.5, 8.3): сохранить копию, восстановить, давность последней копии, напоминание. */
function BackupSection() {
  const status = useBackupStatus()
  const [saveOpen, setSaveOpen] = useState(false)
  const restore = useRestore()
  const now = Date.now()
  const age = backupAgeText(status?.lastBackupAt, now)
  const stale = status !== undefined && isBackupStale(status.lastBackupAt, status.hasCards, now)
  return (
    <>
      <h2 className="m-0 mb-3 flex items-center gap-2 text-heading font-black text-text">
        <CloudUpload size={22} className="text-info" /> Бэкап
      </h2>
      {stale && (
        <div className="mb-3">
          <BackupNudge age={age} never={status.lastBackupAt === undefined} onSave={() => setSaveOpen(true)} />
        </div>
      )}
      <section className="-mx-4 mb-6 border-t-2 border-border">
        <ListRow
          icon={<CloudUpload size={24} className="text-info" />}
          title="Сохранить копию"
          subtitle={`Последняя копия: ${age}`}
          onClick={() => setSaveOpen(true)}
        />
        <ListRow
          icon={<ArchiveRestore size={24} className="text-gem" />}
          title="Восстановить из копии"
          subtitle="Заменит всё на телефоне данными из файла"
          onClick={restore.pick}
        />
      </section>
      <SaveBackupSheet open={saveOpen} onClose={() => setSaveOpen(false)} />
      {restore.ui}
    </>
  )
}
