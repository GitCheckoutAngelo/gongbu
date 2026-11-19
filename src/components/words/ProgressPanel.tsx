import { useRef, useState, type ChangeEvent } from "react";
import { BackupError, parseBackup, serializeBackup } from "../../services/progress/backup";
import { localDate } from "../../services/srs/dates";
import { useWords } from "./WordsContext";

/** Daily limits, plus export/import of a backup file. */
export function ProgressPanel() {
  const { progress, update, storeLabel, saved } = useWords();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const cards = Object.keys(progress.cards).length;

  const setNumber = (key: "newPerDay" | "maxReviews", value: string, min: number, max: number) => {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return;
    update((p) => ({ ...p, settings: { ...p.settings, [key]: Math.min(max, Math.max(min, n)) } }));
  };

  const exportBackup = () => {
    const blob = new Blob([serializeBackup(progress)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `korean-words-backup-${localDate()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMessage({ text: "Backup downloaded." });
  };

  const importBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const imported = parseBackup(await file.text());
      const n = Object.keys(imported.cards).length;
      if (!window.confirm(`Replace your current progress (${cards} cards) with this backup (${n} cards)?`)) return;
      update(imported);
      setMessage({ text: `Imported ${n} cards and ${imported.addedWords.length} added words.` });
    } catch (err) {
      setMessage({ text: err instanceof BackupError ? err.message : "Couldn't read that file.", error: true });
    }
  };

  return (
    <details className="card settings progress-panel">
      <summary>Progress &amp; backup</summary>
      <p className="muted small">
        Saved in: {storeLabel}. {cards} cards started, {progress.addedWords.length} added words. Export a backup now and
        then, or to move to another device.
      </p>
      {!saved && (
        <p className="warning" role="alert">
          Couldn't save (storage may be blocked, e.g. in a private window). Export a backup to keep today's progress.
        </p>
      )}
      <div className="progress-settings">
        <label>
          New words per day
          <input
            type="number"
            min={0}
            max={100}
            value={progress.settings.newPerDay}
            onChange={(e) => setNumber("newPerDay", e.target.value, 0, 100)}
          />
        </label>
        <label>
          Max reviews per session
          <input
            type="number"
            min={1}
            max={9999}
            value={progress.settings.maxReviews}
            onChange={(e) => setNumber("maxReviews", e.target.value, 1, 9999)}
          />
        </label>
      </div>
      <div className="backup-buttons">
        <button type="button" onClick={exportBackup}>
          Export backup
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}>
          Import backup…
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void importBackup(e)} />
      </div>
      {message && (
        <p className={message.error ? "warning" : "muted small"} role="status">
          {message.text}
        </p>
      )}
    </details>
  );
}
