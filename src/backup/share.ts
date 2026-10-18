// Отдать файл владельцу: меню «Поделиться» iPhone («Сохранить в Файлы» → iCloud Drive), иначе — скачивание.
// Вызывать прямо из нажатия: iOS открывает меню только сразу после касания.

export type SaveResult = 'shared' | 'downloaded' | 'cancelled'

export async function saveFile(text: string, fileName: string): Promise<SaveResult> {
  const file = new File([text], fileName, { type: 'application/json' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (e) {
      // Владелец закрыл меню — это не ошибка, копия просто не сохранена.
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // Меню не открылось (например, касание «остыло») — скачиваем.
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return 'downloaded'
}
