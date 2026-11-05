// Settings sheet (SPEC "Settings"): export all data to a file and import it back. Opened from
// SETTINGS on My habits. Import is all or nothing: the file is checked first, then a confirm
// step shows what's in it; REPLACE swaps everything in one transaction.

import { motion } from 'motion/react'
import { useEffect, useState, type ChangeEvent } from 'react'
import { backupFileName, backupSummary, checkBackup, makeBackup, type Backup } from '../storage/backup'
import type { Store } from '../storage/store'
import { Sheet } from './Sheet'

interface Props {
  store: Store
  // The clock: names the file and stamps the export.
  now: () => Date
  reduced: boolean
  // After a restore, so every section reloads.
  onRestored: () => void
  onClose: () => void
}

type Step = { kind: 'idle' } | { kind: 'error'; message: string } | { kind: 'confirm'; backup: Backup } | { kind: 'restored' }

// "27 Oct 2026" in the phone's time zone.
const showDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
// The phone's 'YYYY-MM-DD'.
const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

// The share sheet where there is one (iPhone); a plain download otherwise. True if the file
// went somewhere; false if the share sheet was cancelled.
async function handOver(file: File): Promise<boolean> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Meta Log backup' })
      return true
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false
      throw e
    }
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

export function SettingsSheet({ store, now, reduced, onRestored, onClose }: Props) {
  const [last, setLast] = useState<string | null | undefined>(undefined)
  const [step, setStep] = useState<Step>({ kind: 'idle' })

  useEffect(() => {
    let showing = true
    void store.lastBackup().then((at) => showing && setLast(at))
    return () => {
      showing = false
    }
  }, [store])

  const exportBackup = async () => {
    setStep({ kind: 'idle' })
    const at = now()
    const backup = makeBackup(await store.allData(), at.toISOString())
    const file = new File([JSON.stringify(backup, null, 2)], backupFileName(localDay(at)), { type: 'application/json' })
    try {
      if (!(await handOver(file))) return
    } catch (e) {
      setStep({ kind: 'error', message: `Export didn't finish: ${e instanceof Error ? e.message : String(e)}` })
      return
    }
    await store.setLastBackup(backup.exportedAt)
    setLast(backup.exportedAt)
  }

  const pickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // picking the same file again still works
    if (!file) return
    const result = checkBackup(await file.text())
    setStep(result.ok ? { kind: 'confirm', backup: result.backup } : { kind: 'error', message: result.error })
  }

  const replace = async (backup: Backup) => {
    try {
      await store.replaceAll(backup.data)
    } catch (e) {
      setStep({ kind: 'error', message: `Nothing was changed: ${e instanceof Error ? e.message : String(e)}` })
      return
    }
    await store.setLastBackup(backup.exportedAt)
    setLast(backup.exportedAt)
    setStep({ kind: 'restored' })
    onRestored()
  }

  return (
    <Sheet title="Settings" reduced={reduced} onClose={onClose}>
      {() => (
        <>
          <p className="muted backup-last">{last === undefined ? ' ' : last ? `Last backup: ${showDate(last)}` : 'No backup yet'}</p>

          <div className="backup-action">
            <motion.button className="primary" whileTap={{ scale: 0.95 }} onClick={() => void exportBackup()}>
              Export backup
            </motion.button>
            <p className="muted">Saves all your habits, sessions and points to a file.</p>
          </div>

          <div className="backup-action">
            <label className="primary file-pick">
              Import backup
              <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => void pickFile(e)} />
            </label>
            <p className="muted">Restores a backup file. It replaces all data on this phone.</p>
          </div>

          {step.kind === 'error' && (
            <p role="alert" className="error">
              {step.message}
            </p>
          )}

          {step.kind === 'confirm' && <Confirm backup={step.backup} onReplace={() => void replace(step.backup)} onCancel={() => setStep({ kind: 'idle' })} />}

          {step.kind === 'restored' && (
            <p role="status" className="backup-done">
              Backup restored.
            </p>
          )}
        </>
      )}
    </Sheet>
  )
}

function Confirm({ backup, onReplace, onCancel }: { backup: Backup; onReplace: () => void; onCancel: () => void }) {
  const { exportedAt, onList, sessions } = backupSummary(backup)
  return (
    <div className="backup-confirm">
      <p className="backup-what">{`Backup from ${showDate(exportedAt)} · ${count(onList, 'habit')} on your list · ${count(sessions, 'session')}`}</p>
      <p className="error">This replaces all data on this phone.</p>
      <div className="backup-buttons">
        <motion.button className="primary" whileTap={{ scale: 0.95 }} onClick={onReplace}>
          Replace
        </motion.button>
        <button className="btn-quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
