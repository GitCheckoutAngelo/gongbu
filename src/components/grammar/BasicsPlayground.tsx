/**
 * Grammar → Sentence basics: a small "Try it" card under each step. Nothing is scored or saved;
 * you poke at a sentence and watch what changes (or doesn't).
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { PartRole } from "../../data/sentenceBasics";
import { BASICS_GLOSSARY, type GlossEntry } from "../../data/basicsGlossary";
import { GlossTip, GlossWord } from "./GlossText";

type Listen = (text: string) => ReactNode;

interface Tile {
  ko: string;
  gloss: string;
  role: PartRole;
  /** The particle at the end of `ko`, set apart so the tag stands out (개 + 가). */
  particle?: string;
  /** The hover bubble, when the glossary doesn't have this exact piece. */
  tip?: GlossEntry;
  /** A dimmed label after the meaning, e.g. "subject". */
  label?: string;
}

/**
 * Slides the [data-flip] children of `ref` from where they were to where they are now
 * (a FLIP animation), so swapped words visibly trade places instead of jumping.
 */
function useFlip(ref: RefObject<HTMLElement | null>, deps?: unknown[]) {
  // Positions are kept relative to the row, not the screen: the card slides in when a step
  // opens, and screen positions measured mid-slide would send the first swap off course.
  const before = useRef(new Map<string, { left: number; top: number }>());
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const box = root.getBoundingClientRect();
    const now = new Map<string, { left: number; top: number }>();
    root.querySelectorAll<HTMLElement>("[data-flip]").forEach((el) => {
      el.getAnimations().forEach((a) => a.cancel());
      const key = el.dataset.flip!;
      const r = el.getBoundingClientRect();
      const rect = { left: r.left - box.left, top: r.top - box.top };
      now.set(key, rect);
      const was = before.current.get(key);
      if (!was || still) return;
      const dx = was.left - rect.left;
      const dy = was.top - rect.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "translate(0, 0)" },
        ],
        { duration: 380, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
    });
    before.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  /** Start a tile's next slide from here (where a dragged tile was let go). */
  return (key: string, rect: DOMRect) => {
    const box = ref.current?.getBoundingClientRect();
    if (box)
      before.current.set(key, {
        left: rect.left - box.left,
        top: rect.top - box.top,
      });
  };
}

/** The main word's badge: a pin meaning "this word's seat is the end of the sentence". */
export function MainPin() {
  return (
    <span
      className="main-pin"
      title="The main word: it always goes last"
      aria-label="main word, always last"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4" />
        <path d="M9 15l-4.5 4.5" />
        <path d="M14.5 4l5.5 5.5" />
      </svg>
    </span>
  );
}

function TileView({
  tile,
  flip,
  selected,
  onClick,
  drag,
  main,
  misplaced,
}: {
  tile: Tile;
  /** The sentence's main word: gets the pin. */
  main?: boolean;
  /** The main word, but not at the end: shown in red. */
  misplaced?: boolean;
  /** Stable id for the swap animation. */
  flip: string;
  selected?: boolean;
  onClick?: () => void;
  /** Pointer handlers and the offset while it's being dragged. */
  drag?: {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
    offset: { x: number; y: number } | null;
  };
}) {
  const inner = (
    <>
      <span className="breakdown-ko" lang="ko">
        {main && <MainPin />}
        {tile.particle ? (
          <>
            {tile.ko.slice(0, -tile.particle.length)}
            {/* Marked with its job, so the tag swap can fly it to the other word. */}
            <span className="breakdown-particle" data-tag={tile.role}>
              {tile.particle}
            </span>
          </>
        ) : (
          tile.ko
        )}
      </span>
      <span className="breakdown-gloss">
        {tile.gloss}
        {tile.label && <span className="breakdown-role"> · {tile.label}</span>}
      </span>
      <GlossTip ko={tile.ko} entry={tile.tip} />
    </>
  );
  return onClick ? (
    <button
      type="button"
      className={`breakdown-part has-tip play-tile role-${tile.role}${selected ? " selected" : ""}${drag?.offset ? " dragging" : ""}${misplaced ? " misplaced" : ""}`}
      aria-pressed={selected}
      data-flip={flip}
      onClick={onClick}
      onPointerDown={drag?.onPointerDown}
      style={
        drag?.offset
          ? {
              transform: `translate(${drag.offset.x}px, ${drag.offset.y}px)`,
            }
          : undefined
      }
    >
      {inner}
    </button>
  ) : (
    <span
      className={`breakdown-part has-tip role-${tile.role}`}
      data-flip={flip}
      tabIndex={0}
    >
      {inner}
    </span>
  );
}

/** How a sentence is read, word by word from the glossary (or `rom` when given). */
const romOf = (ko: string) =>
  ko
    .split(" ")
    .map((w) => BASICS_GLOSSARY[w]?.rom ?? "")
    .join(" ")
    .trim();

/** The speaker to hear the Korean, with how it's read and what it means. */
function SentenceLine({
  listen,
  ko,
  en,
  rom,
  broken,
}: {
  listen: Listen;
  ko: string;
  en: string;
  rom?: string;
  /** Not a real sentence: the meaning line is struck through in red. */
  broken?: boolean;
}) {
  return (
    <div className="breakdown-meaning">
      {listen(ko)}
      <span className="breakdown-lines">
        <span className="breakdown-rom">{rom ?? romOf(ko)}</span>
        <span className={`breakdown-en${broken ? " broken" : ""}`}>{en}</span>
      </span>
    </div>
  );
}

/** What just happened and why, under the sentence. Muted until there's something to say. */
function Note({
  tone,
  children,
}: {
  tone: "idle" | "ok" | "bad";
  children: ReactNode;
}) {
  return (
    <p className={`play-note ${tone}`} role="status">
      {children}
    </p>
  );
}

function Feedback({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <p className={`play-feedback ${ok ? "ok" : "bad"}`} role="status">
      {children}
    </p>
  );
}

/* ---------- 1. Word order: swap tiles; the meaning holds as long as the main word is last. ---------- */

/**
 * One sentence for each kind of main word, so it's clear it isn't only verbs that go last.
 * The last tile is the main word. Tags are highlighted: they keep the meaning when words move.
 */
const ORDER_SENTENCES: { label: string; en: string; tiles: Tile[] }[] = [
  {
    label: "Doing",
    en: "My friend reads a book at the library.",
    tiles: [
      {
        ko: "친구가",
        particle: "가",
        gloss: "my friend",
        label: "subject",
        role: "subject",
      },
      {
        ko: "도서관에서",
        particle: "에서",
        gloss: "the library",
        label: "place",
        role: "place",
      },
      {
        ko: "책을",
        particle: "을",
        gloss: "a book",
        label: "object",
        role: "object",
      },
      { ko: "읽어요", gloss: "reads", label: "action", role: "verb" },
    ],
  },
  {
    label: "Describing",
    en: "The weather is nice today.",
    tiles: [
      { ko: "오늘", gloss: "today", label: "time", role: "time" },
      {
        ko: "날씨가",
        particle: "가",
        gloss: "the weather",
        label: "subject",
        role: "subject",
      },
      {
        ko: "좋아요",
        gloss: "is nice",
        label: "description",
        role: "adjective",
      },
    ],
  },
  {
    label: "Identifying",
    en: "I'm a student now.",
    tiles: [
      { ko: "지금", gloss: "now", label: "time", role: "time" },
      {
        ko: "저는",
        particle: "는",
        gloss: "I",
        label: "topic",
        role: "topic",
      },
      {
        ko: "학생이에요",
        gloss: "am a student",
        label: 'noun + "is"',
        role: "noun",
      },
    ],
  },
];

/** Where a dragged word would land: before tile `index` (tiles.length = at the end). */
interface DropSlot {
  index: number;
  /** The insertion line, relative to the row. */
  x: number;
  top: number;
  height: number;
}

/** The slot nearest the pointer: before each other tile, or after the last one. */
function nearestSlot(
  row: HTMLElement,
  from: number,
  px: number,
  py: number,
): DropSlot | null {
  const box = row.getBoundingClientRect();
  const els = Array.from(row.querySelectorAll<HTMLElement>("[data-flip]"));
  const kos = els.map((el) => el.querySelector(".breakdown-ko") ?? el);
  const slots: DropSlot[] = [];
  els.forEach((_, i) => {
    const r = kos[i].getBoundingClientRect();
    slots.push({
      index: i,
      x: r.left - box.left - 4,
      top: r.top - box.top,
      height: r.height,
    });
    if (i === els.length - 1)
      slots.push({
        index: i + 1,
        x: r.right - box.left + 4,
        top: r.top - box.top,
        height: r.height,
      });
  });
  // Dropping right before or after itself changes nothing.
  const useful = slots.filter((s) => s.index !== from && s.index !== from + 1);
  let best: DropSlot | null = null;
  let bestD = Infinity;
  for (const s of useful) {
    const d =
      Math.abs(box.left + s.x - px) +
      2 * Math.abs(box.top + s.top + s.height / 2 - py);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/**
 * The first time the row scrolls into view, give each tile a small hop, one after another,
 * as a hint that they can be moved. Once per visit; skipped when reduced motion is asked for.
 */
function useNudge(ref: RefObject<HTMLElement | null>) {
  useFirstView(ref, (row) =>
    row
      .querySelectorAll<HTMLElement>(".breakdown-ko")
      .forEach((ko, i) =>
        ko.animate(
          [
            { transform: "translateY(0)" },
            { transform: "translateY(-5px)", offset: 0.4 },
            { transform: "translateY(0)" },
          ],
          { duration: 420, delay: i * 90, easing: "ease-in-out" },
        ),
      ),
  );
}

/** Runs `play` once, shortly after `ref` first scrolls (mostly) into view. Not with reduced motion. */
function useFirstView(
  ref: RefObject<HTMLElement | null>,
  play: (el: HTMLElement) => void,
) {
  const latest = useRef(play);
  latest.current = play;
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        seen.disconnect();
        timer = window.setTimeout(() => latest.current(el), 400);
      },
      { threshold: 0.8 },
    );
    seen.observe(el);
    return () => {
      seen.disconnect();
      window.clearTimeout(timer);
    };
  }, [ref]);
}

function OrderPlay({ listen }: { listen: Listen }) {
  const [which, setWhich] = useState(0);
  const chosen = ORDER_SENTENCES[which];
  const main = chosen.tiles[chosen.tiles.length - 1];
  const [tiles, setTiles] = useState(chosen.tiles);
  const [picked, setPicked] = useState<number | null>(null);
  const [moved, setMoved] = useState(false);
  const [drag, setDrag] = useState<{
    from: number;
    offset: { x: number; y: number };
    slot: DropSlot | null;
  } | null>(null);
  const reset = (to = which) => {
    setWhich(to);
    setTiles(ORDER_SENTENCES[to].tiles);
    setPicked(null);
    setMoved(false);
  };
  const mainLast = tiles[tiles.length - 1] === main;
  const sentence = tiles.map((t) => t.ko).join(" ");
  const row = useRef<HTMLDivElement>(null);
  const startFrom = useFlip(row, [tiles]);
  useNudge(row);

  /** Tap one word, then another, to swap them (also works without a mouse). */
  const tap = (i: number) => {
    if (picked === null) return setPicked(i);
    if (picked !== i) {
      const next = [...tiles];
      [next[picked], next[i]] = [next[i], next[picked]];
      setTiles(next);
      setMoved(true);
    }
    setPicked(null);
  };

  /** Press and drag a word; let go and it moves to where the line shows. */
  const startDrag = (from: number) => (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    const sx = e.clientX;
    const sy = e.clientY;
    let dragging = false;
    let slot: DropSlot | null = null;
    const move = (ev: PointerEvent) => {
      const x = ev.clientX - sx;
      const y = ev.clientY - sy;
      if (!dragging && Math.hypot(x, y) < 6) return;
      if (!dragging) {
        dragging = true;
        setPicked(null);
      }
      slot = row.current
        ? nearestSlot(row.current, from, ev.clientX, ev.clientY)
        : null;
      setDrag({ from, offset: { x, y }, slot });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (!dragging) return;
      // The click that follows a drag shouldn't count as a tap.
      el.addEventListener("click", (c) => c.stopPropagation(), {
        capture: true,
        once: true,
      });
      startFrom(tiles[from].ko, el.getBoundingClientRect());
      setDrag(null);
      if (slot) {
        const next = tiles.filter((_, i) => i !== from);
        next.splice(
          slot.index > from ? slot.index - 1 : slot.index,
          0,
          tiles[from],
        );
        setTiles(next);
        setMoved(true);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return (
    <>
      <div className="play-options" role="group" aria-label="Sentence type">
        {ORDER_SENTENCES.map((s, i) => (
          <button
            key={s.label}
            type="button"
            className="play-option"
            aria-pressed={which === i}
            onClick={() => reset(i)}
          >
            <span className="play-option-label">{s.label}</span>
          </button>
        ))}
      </div>
      <p className="play-hint small muted">
        Whatever the sentence type, its main word goes last. Drag a word to a
        new spot (or tap two words to swap them), and try moving{" "}
        <span lang="ko">{main.ko}</span>, the main word, too.
      </p>
      <div className="breakdown-parts play-drag-row" ref={row}>
        {tiles.map((t, i) => (
          <TileView
            key={t.ko}
            flip={t.ko}
            tile={t}
            selected={picked === i}
            onClick={() => tap(i)}
            main={t === main}
            misplaced={t === main && !mainLast}
            drag={{
              onPointerDown: startDrag(i),
              offset: drag?.from === i ? drag.offset : null,
            }}
          />
        ))}
        {/* Where the main word belongs, shown while it's somewhere else: a thin line, not a box. */}
        {!mainLast && (
          <span className="play-end" aria-hidden="true">
            <span className="play-end-label">end</span>
          </span>
        )}
        {drag?.slot && (
          <span
            className="play-drop-line"
            aria-hidden="true"
            style={{
              left: drag.slot.x,
              top: drag.slot.top,
              height: drag.slot.height,
            }}
          />
        )}
      </div>
      {/* Same two lines either way, so the card keeps its height. */}
      <SentenceLine
        listen={listen}
        ko={sentence}
        en={mainLast ? chosen.en : "Not a sentence"}
        broken={!mainLast}
      />
      <div className="play-slot">
        {!moved ? (
          <Note tone="idle">Move a word to see what changes.</Note>
        ) : mainLast ? (
          <Note tone="ok">
            Same meaning: each word&rsquo;s job stays clear wherever it sits.
            Only the focus shifts, to the word just before the last one.
          </Note>
        ) : (
          <Note tone="bad">
            <span lang="ko">{main.ko}</span> ({main.gloss}) is the main word, so
            it has to come last. Move it back to the end.
          </Note>
        )}
        <button
          type="button"
          className="play-reset"
          style={{ visibility: moved ? "visible" : "hidden" }}
          onClick={() => reset()}
        >
          Reset
        </button>
      </div>
    </>
  );
}

/* ---------- 2. Particles: swap places (same meaning) or swap tags (meaning flips). ---------- */

const ANIMALS = {
  dog: { ko: "개", en: "dog", subj: "가", obj: "를" },
  // Both end in a vowel, so the tags keep their form (가, 를) when they swap.
  cat: { ko: "고양이", en: "cat", subj: "가", obj: "를" },
} as const;

function ParticlePlay({ listen }: { listen: Listen }) {
  const [dogSees, setDogSees] = useState(true);
  const [dogFirst, setDogFirst] = useState(true);
  const [last, setLast] = useState<"places" | "tags" | null>(null);
  const tile = (key: keyof typeof ANIMALS): Tile => {
    const a = ANIMALS[key];
    const isSubj = (key === "dog") === dogSees;
    const particle = isSubj ? a.subj : a.obj;
    return {
      ko: a.ko + particle,
      particle,
      gloss: a.en,
      label: isSubj ? "subject" : "object",
      role: isSubj ? "subject" : "object",
    };
  };
  const nouns = dogFirst
    ? [tile("dog"), tile("cat")]
    : [tile("cat"), tile("dog")];
  const tiles = [
    ...nouns,
    { ko: "봐요", gloss: "sees", label: "action", role: "verb" as const },
  ];
  const en = dogSees ? "The dog sees the cat." : "The cat sees the dog.";
  const row = useRef<HTMLDivElement>(null);
  useFlip(row);
  // First view: the two tags lean toward each other and settle back, a hint that they move.
  useFirstView(row, (el) => {
    const [t1, t2] = Array.from(el.querySelectorAll<HTMLElement>("[data-tag]"));
    if (!t1 || !t2) return;
    const a = t1.getBoundingClientRect();
    const b = t2.getBoundingClientRect();
    const dx = (b.left - a.left) * 0.25;
    const lean = (el: HTMLElement, x: number, lift: number) =>
      el.animate(
        [
          { transform: "translate(0, 0)" },
          {
            transform: `translate(${x}px, ${lift}px) scale(1.15)`,
            offset: 0.45,
          },
          { transform: "translate(0, 0)" },
        ],
        { duration: 900, easing: "cubic-bezier(0.45, 0, 0.25, 1)" },
      );
    lean(t1, dx, -8);
    lean(t2, -dx, 6);
  });

  // Swapping tags: note where each tag is now, then after the swap fly it from there to its new
  // word in a little arc (subject over the top, object underneath), changing form on the way.
  const tagsWere = useRef<Map<string, { left: number; top: number }> | null>(
    null,
  );
  const tintsWere = useRef<Map<string, string> | null>(null);
  const swapTags = () => {
    const tints = new Map<string, string>();
    row.current
      ?.querySelectorAll<HTMLElement>("[data-flip]")
      .forEach((part) => {
        const ko = part.querySelector<HTMLElement>(".breakdown-ko");
        if (ko)
          tints.set(part.dataset.flip!, getComputedStyle(ko).backgroundColor);
      });
    tintsWere.current = tints;
    const was = new Map<string, { left: number; top: number }>();
    const box = row.current?.getBoundingClientRect();
    row.current?.querySelectorAll<HTMLElement>("[data-tag]").forEach((el) => {
      const r = el.getBoundingClientRect();
      was.set(el.dataset.tag!, {
        left: r.left - (box?.left ?? 0),
        top: r.top - (box?.top ?? 0),
      });
    });
    tagsWere.current = was;
    // While the tags fly, the words keep their old colours; they change as the tags land.
    const el = row.current;
    if (el) {
      el.dataset.swapping = "";
      window.clearTimeout(Number(el.dataset.swapTimer));
      el.dataset.swapTimer = String(
        window.setTimeout(() => delete el.dataset.swapping, 1200),
      );
    }
    setDogSees(!dogSees);
    setLast("tags");
  };
  useLayoutEffect(() => {
    const was = tagsWere.current;
    tagsWere.current = null;
    if (!was || !row.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    row.current.querySelectorAll<HTMLElement>("[data-tag]").forEach((el) => {
      const from = was.get(el.dataset.tag!);
      if (!from) return;
      const box = row.current!.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const dx = from.left - (r.left - box.left);
      const dy = from.top - (r.top - box.top);
      const lift = el.dataset.tag === "subject" ? -22 : 18;
      el.getAnimations().forEach((a) => a.cancel());
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          {
            transform: `translate(${dx / 2}px, ${dy / 2 + lift}px) scale(1.25)`,
            offset: 0.5,
          },
          { transform: "translate(0, 0)" },
        ],
        { duration: 650, easing: "cubic-bezier(0.45, 0, 0.25, 1)" },
      );
    });
    // Each word's new tint spreads out from its tag, like the tag colouring the word as it lands:
    // the word keeps its old tint, and a circle of the new one grows from the tag's centre.
    const tints = tintsWere.current;
    tintsWere.current = null;
    row.current.querySelectorAll<HTMLElement>("[data-flip]").forEach((part) => {
      const ko = part.querySelector<HTMLElement>(".breakdown-ko");
      const tag = part.querySelector<HTMLElement>("[data-tag]");
      const old = tints?.get(part.dataset.flip!);
      if (!ko || !tag || !old) return; // only words with a tag
      if (getComputedStyle(ko).backgroundColor === old) return;
      // From the word's end, where the tag sits, across to its start.
      const box = ko.getBoundingClientRect();
      const x = box.width;
      const reach = Math.hypot(box.width, box.height);
      ko.style.backgroundColor = old;
      const spread = ko.animate(
        [
          { clipPath: `circle(0px at ${x}px 50%)` },
          { clipPath: `circle(${reach}px at ${x}px 50%)` },
        ],
        {
          pseudoElement: "::before",
          delay: 600,
          duration: 550,
          easing: "ease-out",
          fill: "both",
        },
      );
      spread.onfinish = spread.oncancel = () => {
        ko.style.backgroundColor = "";
        spread.cancel();
      };
    });
  }, [dogSees]);

  return (
    <>
      <p className="play-hint small muted">
        Try each button and watch the English below. The tag is the highlighted
        last syllable.
      </p>
      <div className="breakdown-parts" ref={row}>
        {tiles.map((t) => {
          // Keyed by the animal, not the word, so it slides when the words swap.
          const id =
            t.role === "verb" ? "verb" : t.ko.startsWith("개") ? "dog" : "cat";
          return <TileView key={id} flip={id} tile={t} />;
        })}
      </div>
      <div className="play-buttons">
        <button
          type="button"
          onClick={() => {
            setDogFirst(!dogFirst);
            setLast("places");
          }}
        >
          Swap the words
        </button>
        <button type="button" onClick={swapTags}>
          Swap only the tags
        </button>
      </div>
      <SentenceLine
        listen={listen}
        ko={tiles.map((t) => t.ko).join(" ")}
        en={en}
      />
      {last === null && (
        <Note tone="idle">Tap a button to see what changes.</Note>
      )}
      {last === "places" && (
        <Note tone="ok">
          Same meaning. Each tag moved with its word, so the jobs didn&rsquo;t
          change.
        </Note>
      )}
      {last === "tags" && (
        <Note tone="ok">
          The meaning flipped. Whoever has the subject tag (가) does the seeing.
        </Note>
      )}
    </>
  );
}

/* ---------- 3. Sentence types: say which kind each sentence is, one after another. ---------- */

type SentenceType = "doing" | "describing" | "identifying";

/** Each word with its meaning (shown on hover or tap). The last word decides the type. */
const TYPE_SENTENCES: {
  words: [string, string][];
  en: string;
  type: SentenceType;
}[] = [
  {
    words: [
      ["동생이", "younger sibling"],
      ["밥을", "rice, a meal"],
      ["먹어요", "eats"],
    ],
    en: "My younger sibling eats.",
    type: "doing",
  },
  {
    words: [
      ["날씨가", "the weather"],
      ["좋아요", "is nice"],
    ],
    en: "The weather is nice.",
    type: "describing",
  },
  {
    words: [
      ["이것은", "this"],
      ["사과예요", "is an apple"],
    ],
    en: "This is an apple.",
    type: "identifying",
  },
  {
    words: [
      ["방이", "the room"],
      ["커요", "is big"],
    ],
    en: "The room is big.",
    type: "describing",
  },
  {
    words: [
      ["저는", "I"],
      ["학교에", "to school"],
      ["가요", "go"],
    ],
    en: "I go to school.",
    type: "doing",
  },
  {
    words: [
      ["제", "my"],
      ["친구는", "friend"],
      ["의사예요", "is a doctor"],
    ],
    en: "My friend is a doctor.",
    type: "identifying",
  },
  {
    words: [
      ["한국어가", "Korean (the language)"],
      ["재미있어요", "is fun"],
    ],
    en: "Korean is fun.",
    type: "describing",
  },
  {
    words: [
      ["친구가", "my friend"],
      ["노래해요", "sings"],
    ],
    en: "My friend sings.",
    type: "doing",
  },
  {
    words: [
      ["오늘은", "today"],
      ["금요일이에요", "is Friday"],
    ],
    en: "Today is Friday.",
    type: "identifying",
  },
];

const TYPE_OPTIONS: {
  id: SentenceType;
  label: string;
  hint: string;
  why: string;
}[] = [
  {
    id: "doing",
    label: "Doing",
    hint: "an action",
    why: "is an action",
  },
  {
    id: "describing",
    label: "Describing",
    hint: "what it's like",
    why: "says what something is like",
  },
  {
    id: "identifying",
    label: "Identifying",
    hint: "noun + 이에요",
    why: "is a noun + 이에요/예요",
  },
];

function TypesPlay({ listen }: { listen: Listen }) {
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<SentenceType | null>(null);
  const s = TYPE_SENTENCES[i % TYPE_SENTENCES.length];
  const lastWord = s.words[s.words.length - 1];
  const right = TYPE_OPTIONS.find((o) => o.id === s.type)!;
  return (
    <>
      <p className="play-hint small muted">
        Which kind of sentence is this? Hover or tap a word for its meaning.
      </p>
      <div className="play-result">
        {listen(s.words.map((w) => w[0]).join(" "))}
        <span className="breakdown-lines">
          <span className="play-sentence">
            {s.words.map(([ko], k) => (
              <span key={k}>
                {k > 0 && " "}
                <GlossWord ko={ko} />
              </span>
            ))}
          </span>
          <span className="breakdown-rom">
            {romOf(s.words.map((w) => w[0]).join(" "))}
          </span>
        </span>
      </div>
      <div className="play-options" role="group" aria-label="Your answer">
        {TYPE_OPTIONS.map((o) => {
          const state = !answer
            ? ""
            : o.id === s.type
              ? " correct"
              : o.id === answer
                ? " wrong"
                : " dim";
          return (
            <button
              key={o.id}
              type="button"
              className={`play-option${state}`}
              disabled={answer !== null}
              onClick={() => setAnswer(o.id)}
            >
              <span className="play-option-mark" aria-hidden="true" />
              <span className="play-option-text">
                <span className="play-option-label">{o.label}</span>
                <span className="play-option-hint">{o.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="play-slot">
        {answer ? (
          <Feedback ok={answer === s.type}>
            {answer === s.type ? "Yes! " : "Not quite. "}
            <span lang="ko">{lastWord[0]}</span> ({lastWord[1]}) {right.why}:
            &ldquo;{s.en}&rdquo;
          </Feedback>
        ) : (
          <p className="play-feedback small muted">
            Pick an answer to check it.
          </p>
        )}
        <button
          type="button"
          className="play-reset"
          style={{ visibility: answer ? "visible" : "hidden" }}
          onClick={() => {
            setI(i + 1);
            setAnswer(null);
          }}
        >
          Next sentence
        </button>
      </div>
    </>
  );
}

/* ---------- 4. Verb endings: pick a verb and an ending, see the word it makes. ---------- */

const ENDINGS = [
  { id: "now", label: "now", ending: "-아요/어요" },
  { id: "past", label: "past", ending: "-았/었어요" },
  { id: "will", label: "will", ending: "-(으)ㄹ 거예요" },
  { id: "want", label: "want to", ending: "-고 싶어요" },
] as const;
type EndingId = (typeof ENDINGS)[number]["id"];

const VERBS: {
  dict: string;
  en: string;
  forms: Record<
    EndingId,
    { stem: string; end: string; word: string; en: string; merge?: string }
  >;
}[] = [
  {
    dict: "먹다",
    en: "eat",
    forms: {
      now: { stem: "먹", end: "어요", word: "먹어요", en: "I eat." },
      past: { stem: "먹", end: "었어요", word: "먹었어요", en: "I ate." },
      will: {
        stem: "먹",
        end: "을 거예요",
        word: "먹을 거예요",
        en: "I will eat.",
      },
      want: {
        stem: "먹",
        end: "고 싶어요",
        word: "먹고 싶어요",
        en: "I want to eat.",
      },
    },
  },
  {
    dict: "가다",
    en: "go",
    forms: {
      now: {
        stem: "가",
        end: "아요",
        word: "가요",
        en: "I go.",
        merge: "가 + 아 merge into 가",
      },
      past: {
        stem: "가",
        end: "았어요",
        word: "갔어요",
        en: "I went.",
        merge: "가 + 았 merge into 갔",
      },
      will: {
        stem: "가",
        end: "ㄹ 거예요",
        word: "갈 거예요",
        en: "I will go.",
        merge: "after a vowel, ㄹ tucks under the stem",
      },
      want: {
        stem: "가",
        end: "고 싶어요",
        word: "가고 싶어요",
        en: "I want to go.",
      },
    },
  },
  {
    dict: "마시다",
    en: "drink",
    forms: {
      now: {
        stem: "마시",
        end: "어요",
        word: "마셔요",
        en: "I drink.",
        merge: "시 + 어 merge into 셔",
      },
      past: {
        stem: "마시",
        end: "었어요",
        word: "마셨어요",
        en: "I drank.",
        merge: "시 + 었 merge into 셨",
      },
      will: {
        stem: "마시",
        end: "ㄹ 거예요",
        word: "마실 거예요",
        en: "I will drink.",
        merge: "after a vowel, ㄹ tucks under the stem",
      },
      want: {
        stem: "마시",
        end: "고 싶어요",
        word: "마시고 싶어요",
        en: "I want to drink.",
      },
    },
  },
];

/** How each stem, ending and finished word is read, for the hover bubbles. */
const ENDINGS_ROM: Record<string, string> = {
  먹: "meok",
  가: "ga",
  마시: "masi",
  어요: "eoyo",
  아요: "ayo",
  었어요: "eosseoyo",
  았어요: "asseoyo",
  "을 거예요": "eul geoyeyo",
  "ㄹ 거예요": "l geoyeyo",
  "고 싶어요": "go sipeoyo",
  먹어요: "meogeoyo",
  먹었어요: "meogeosseoyo",
  "먹을 거예요": "meogeul geoyeyo",
  "먹고 싶어요": "meokgo sipeoyo",
  가요: "gayo",
  갔어요: "gasseoyo",
  "갈 거예요": "gal geoyeyo",
  "가고 싶어요": "gago sipeoyo",
  마셔요: "masyeoyo",
  마셨어요: "masyeosseoyo",
  "마실 거예요": "masil geoyeyo",
  "마시고 싶어요": "masigo sipeoyo",
};

const ENDING_MEANS: Record<EndingId, string> = {
  now: "now, polite",
  past: "past, polite",
  will: "will",
  want: "want to",
};

function EndingsPlay({ listen }: { listen: Listen }) {
  const [v, setV] = useState(0);
  const [e, setE] = useState<EndingId>("now");
  const verb = VERBS[v];
  const f = verb.forms[e];
  const tip = (ko: string, en: string): GlossEntry => ({
    rom: ENDINGS_ROM[ko] ?? "",
    en,
  });
  return (
    <>
      <p className="play-hint small muted">Pick a verb, then an ending.</p>
      <div className="play-buttons">
        {VERBS.map((x, i) => (
          <button
            key={x.dict}
            type="button"
            aria-pressed={v === i}
            onClick={() => setV(i)}
          >
            <span lang="ko">{x.dict}</span> {x.en}
          </button>
        ))}
      </div>
      <div className="play-buttons">
        {ENDINGS.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={e === x.id}
            onClick={() => setE(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="breakdown-parts">
        <TileView
          flip="stem"
          tile={{
            ko: f.stem,
            gloss: "stem",
            role: "stem",
            tip: tip(f.stem, `${verb.en}: the stem of ${verb.dict}`),
          }}
        />
        <span className="play-op">+</span>
        <TileView
          flip="end"
          tile={{
            ko: f.end,
            gloss: "ending",
            role: "ending",
            tip: tip(f.end, `${ENDING_MEANS[e]} (ending)`),
          }}
        />
        <span className="play-op">=</span>
        <TileView
          flip="word"
          tile={{
            ko: f.word,
            gloss: f.en,
            role: "verb",
            tip: tip(
              f.word,
              `${f.en.replace(/\.$/, "")}: ${verb.en} (${f.stem}) + ${ENDING_MEANS[e]} (${f.end})`,
            ),
          }}
        />
      </div>
      <SentenceLine
        listen={listen}
        ko={f.word}
        rom={ENDINGS_ROM[f.word]}
        en={f.en}
      />
      <Note tone={f.merge ? "ok" : "idle"}>
        {f.merge ? `How it joins: ${f.merge}.` : "Stem and ending simply join."}
      </Note>
    </>
  );
}

const PLAYS: Record<string, (p: { listen: Listen }) => ReactNode> = {
  order: OrderPlay,
  particles: ParticlePlay,
  types: TypesPlay,
  stems: EndingsPlay,
};

/** The "Try it" card for a Sentence basics step, or nothing if that step has none. */
export function BasicsPlayground({
  topicId,
  listen,
}: {
  topicId: string;
  listen: Listen;
}) {
  const Play = PLAYS[topicId];
  if (!Play) return null;
  return (
    <section className="play" aria-label="Try it">
      <h4 className="play-title">Try it</h4>
      <Play listen={listen} />
    </section>
  );
}
