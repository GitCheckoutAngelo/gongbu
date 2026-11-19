/**
 * Choose a Google Cloud voice: a family (Standard … Chirp 3 HD), then a voice in it, with a preview.
 * The list comes from the server (GET /api/tts/voices), so it matches what Google actually offers.
 */
import { useEffect, useState } from "react";
import { listTtsVoices, type TtsVoiceInfo } from "../api/client";
import { useTts } from "../tts/TtsContext";
import { StableLabel } from "./StableLabel";
import { IconPlay } from "./words/icons";

const FAMILIES = [
  { id: "Standard", label: "Standard", note: "Basic. Largest free tier." },
  { id: "Wavenet", label: "WaveNet", note: "Smoother than Standard." },
  { id: "Neural2", label: "Neural2", note: "Natural-sounding." },
  { id: "Chirp3-HD", label: "Chirp 3 HD", note: "Newest and most natural. Costs the most." },
];

const SAMPLE = "안녕하세요. 만나서 반갑습니다.";
/** Families with more voices than this get a female/male switch. */
const SPLIT_OVER = 8;

/** Fetched once per page load. */
let voicesPromise: Promise<{ voices: TtsVoiceInfo[]; default: string }> | undefined;
const loadVoices = () =>
  (voicesPromise ??= listTtsVoices().catch((err) => ((voicesPromise = undefined), Promise.reject(err))));

/** "ko-KR-Neural2-A" → "A"; "ko-KR-Chirp3-HD-Kore" → "Kore". */
const shortName = (name: string) => name.split("-").pop() ?? name;
const genderMark = (g: TtsVoiceInfo["gender"]) => (g === "female" ? "♀" : g === "male" ? "♂" : "");

export function GoogleVoicePicker() {
  const { googleVoice, setGoogleVoice, speak, stop, playingKey, loadingKey } = useTts();
  const [data, setData] = useState<{ voices: TtsVoiceInfo[]; default: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = googleVoice || data?.default || "";
  const [family, setFamily] = useState<string>("");
  /** Big families (Chirp 3 HD has 30 voices) are split by gender, so the list fits without scrolling. */
  const [gender, setGender] = useState<"female" | "male" | "">("");

  useEffect(() => {
    loadVoices()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Couldn't load the voices."));
  }, []);

  // Show the family (and gender) of the voice in use once the list arrives.
  useEffect(() => {
    if (!data || family) return;
    const current = data.voices.find((v) => v.name === active);
    setFamily(current?.family ?? "Standard");
    setGender(current?.gender === "male" ? "male" : "female");
  }, [data, active, family]);

  if (error) return <p className="warning small settings-warning">{error}</p>;
  if (!data) return <p className="muted small">Loading voices…</p>;

  const familyVoices = data.voices.filter((v) => v.family === family);
  const splitByGender = familyVoices.length > SPLIT_OVER;
  const inFamily = splitByGender ? familyVoices.filter((v) => v.gender === (gender || "female")) : familyVoices;
  const familyInfo = FAMILIES.find((f) => f.id === family);
  const previewKey = `voice-preview`;
  const previewing = playingKey === previewKey;
  const previewLoading = loadingKey === previewKey;

  return (
    <div className="voice-picker">
      <div className="family-pills" role="radiogroup" aria-label="Google voice type">
        {FAMILIES.filter((f) => data.voices.some((v) => v.family === f.id)).map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={f.id === family}
            className={`family-pill${f.id === family ? " selected" : ""}`}
            onClick={() => setFamily(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {familyInfo && <p className="muted small family-note">{familyInfo.note}</p>}

      {splitByGender && (
        <div className="gender-switch" role="radiogroup" aria-label="Voice gender">
          {(["female", "male"] as const).map((g) => {
            const n = familyVoices.filter((v) => v.gender === g).length;
            const selected = (gender || "female") === g;
            return (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`gender-option ${g}${selected ? " selected" : ""}`}
                onClick={() => setGender(g)}
              >
                <span aria-hidden="true">{genderMark(g)}</span> {g === "female" ? "Female" : "Male"}
                <span className="gender-count">{n}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className={`voice-chips${family === "Chirp3-HD" ? " named" : ""}`} role="radiogroup" aria-label="Voice">
        {inFamily.map((v) => {
          const selected = v.name === active;
          return (
            <button
              key={v.name}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`voice-chip ${v.gender}${selected ? " selected" : ""}`}
              title={v.name}
              onClick={() => setGoogleVoice(v.name === data.default ? "" : v.name)}
            >
              <span className="voice-name">{shortName(v.name)}</span>
              <span className="voice-gender" aria-label={v.gender}>
                {genderMark(v.gender)}
              </span>
              {v.name === data.default && <span className="voice-default">default</span>}
            </button>
          );
        })}
      </div>

      <div className="voice-preview-row">
        <span className="muted small voice-current" title={active}>
          Using {shortName(active)} ({active.includes("Chirp3") ? "Chirp 3 HD" : active.split("-")[2]})
        </span>
        <button
          type="button"
          className="voice-preview"
          onClick={() => (previewing ? stop() : void speak(SAMPLE, previewKey))}
        >
          <span className="icon-slot" aria-hidden="true">
            {previewLoading ? (
              <span className="spinner" />
            ) : previewing ? (
              <span className="pause-icon" />
            ) : (
              <IconPlay />
            )}
          </span>
          <StableLabel
            options={["Preview", "Stop", "Loading…"]}
            current={previewLoading ? "Loading…" : previewing ? "Stop" : "Preview"}
          />
        </button>
      </div>
      <p className="muted small">
        Better voices cost more per character after the free tier. See{" "}
        <a href="https://cloud.google.com/text-to-speech/pricing" target="_blank" rel="noreferrer">
          Google's pricing
        </a>
        .
      </p>
    </div>
  );
}
