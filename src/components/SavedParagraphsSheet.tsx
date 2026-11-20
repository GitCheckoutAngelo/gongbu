/**
 * Reader: the learner's saved paragraphs, in a sheet (centered on wide screens, a bottom sheet on
 * phones). Open one to read it again, or delete it. The list comes from the server (saved under this
 * browser's sync key).
 */
import { useEffect, useRef, useState } from "react";
import { deleteSavedParagraph, listSavedParagraphs, type SavedParagraphSummary } from "../api/client";
import { DIFFICULTIES, LENGTHS } from "./GenerateForm";
import { IconTrash } from "./words/icons";

/** Matches the .sheet-backdrop.closing animation in styles.css. */
const CLOSE_MS = 200;

const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

export function SavedParagraphsSheet({
  currentId,
  onOpen,
  onDeleted,
  onClose,
}: {
  /** The saved paragraph on screen, if any (marked in the list). */
  currentId: string | null;
  /** Open this one in the Reader. Rejects with a message if it couldn't be loaded. */
  onOpen: (id: string) => Promise<void>;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<SavedParagraphSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  };

  useEffect(() => {
    let live = true;
    listSavedParagraphs()
      .then((list) => live && setItems(list))
      .catch((err: Error) => live && setError(err.message));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    document.body.classList.add("no-scroll");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("no-scroll");
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const open = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await onOpen(id);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open that paragraph.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item: SavedParagraphSummary) => {
    if (!window.confirm(`Delete this saved paragraph?\n\n${item.preview}…`)) return;
    setBusyId(item.id);
    setError(null);
    try {
      await deleteSavedParagraph(item.id);
      setItems((list) => list?.filter((p) => p.id !== item.id) ?? null);
      onDeleted(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete that paragraph.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={`sheet-backdrop${closing ? " closing" : ""}`} onClick={close}>
      <div
        className="sheet saved-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="sheet-close" aria-label="Close" onClick={close}>
          ×
        </button>
        <h2 id="saved-sheet-title" className="saved-title">
          Saved paragraphs
        </h2>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {!items && !error && (
          <p className="muted saved-status" aria-busy="true">
            <span className="spinner" aria-hidden="true" /> Loading…
          </p>
        )}

        {items?.length === 0 && (
          <p className="muted saved-status">
            Nothing saved yet. Press <strong>Save</strong> under a paragraph to keep it here.
          </p>
        )}

        {items && items.length > 0 && (
          <ul className="saved-list">
            {items.map((item) => {
              const level = DIFFICULTIES.find((d) => d.value === item.difficulty);
              const length = LENGTHS.find((l) => l.value === item.length);
              return (
                <li key={item.id} className={`saved-item${item.id === currentId ? " current" : ""}`}>
                  <button
                    type="button"
                    className="saved-open"
                    disabled={busyId !== null}
                    aria-busy={busyId === item.id || undefined}
                    onClick={() => void open(item.id)}
                  >
                    <span className="saved-preview" lang="ko">
                      {item.preview}…
                    </span>
                    <span className="saved-meta muted small">
                      {[level?.label, length?.label, item.topic].filter(Boolean).join(" · ")}
                      <span aria-hidden="true"> · </span>
                      {dateFormat.format(item.createdAt)}
                      {item.id === currentId && <span className="saved-current"> · Open now</span>}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="saved-delete"
                    disabled={busyId !== null}
                    aria-label={`Delete "${item.preview}…"`}
                    title="Delete"
                    onClick={() => void remove(item)}
                  >
                    <IconTrash />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
