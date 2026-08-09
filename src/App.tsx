import { useEffect, useState, type FormEvent } from "react";
import {
  deleteWord,
  fetchNewWord,
  fetchStore,
  fetchTodayWord,
  saveSentence,
} from "./api";
import { localDateKey } from "./dates";
import type { VocabWord } from "./types";
import "./App.css";

function App() {
  const [word, setWord] = useState<VocabWord | null>(null);
  const [saved, setSaved] = useState<VocabWord[]>([]);
  const [sentence, setSentence] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        setError(null);
        const store = await fetchStore();
        if (cancelled) return;
        setSaved(store.saved);

        const today = await fetchTodayWord();
        if (cancelled) return;
        setWord(today);

        const existing = store.saved.find((s) => s.id === today.id);
        setSentence(existing?.userSentence ?? "");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleNewWord() {
    setRefreshing(true);
    setError(null);
    setSuccess(null);
    try {
      const next = await fetchNewWord();
      setWord(next);
      setSentence("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not fetch a new word",
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!word) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await saveSentence(sentence, word);
      setSaved(result.saved);
      setSuccess("Saved to your vocabulary list.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const result = await deleteWord(id);
      setSaved(result.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    }
  }

  const alreadySaved = Boolean(word && saved.some((s) => s.id === word.id));

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden="true" />

      <header className="top">
        <p className="brand">Vocab Master</p>
        <button
          type="button"
          className="ghost"
          onClick={() => setShowHistory((v) => !v)}
          aria-expanded={showHistory}
        >
          {showHistory ? "Practice" : `Words (${saved.length})`}
        </button>
      </header>

      <main className="main">
        {showHistory ? (
          <section className="history" aria-label="Saved words">
            <h1 className="section-title">Your words</h1>
            <p className="section-copy">
              Saved in MongoDB so they sync across devices.
            </p>
            {saved.length === 0 ? (
              <p className="empty">No words saved yet. Practice one first.</p>
            ) : (
              <ul className="history-list">
                {saved.map((item) => (
                  <li key={item.id} className="history-item">
                    <div className="history-head">
                      <h2>{item.word}</h2>
                      <button
                        type="button"
                        className="ghost danger"
                        onClick={() => void handleDelete(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                    <p className="meaning">{item.meaning}</p>
                    <p className="user-line">
                      <span>You wrote:</span> {item.userSentence}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <section className="practice" aria-label="Daily practice">
            {loading ? (
              <div className="status pulse">Finding today’s word…</div>
            ) : word ? (
              <>
                <div className="word-stage">
                  <p className="eyebrow">
                    {word.date === localDateKey()
                      ? "Today’s word"
                      : "Practice word"}
                  </p>
                  <h1 className="word" key={word.id}>
                    {word.word}
                  </h1>
                  <p className="meta">
                    {word.phonetic && <span>{word.phonetic}</span>}
                    {word.partOfSpeech && (
                      <span className="pos">{word.partOfSpeech}</span>
                    )}
                  </p>
                </div>

                <div className="definition">
                  <h2>Meaning</h2>
                  <p>{word.meaning}</p>
                  <h2>Example</h2>
                  <p className="example">“{word.example}”</p>
                </div>

                <form className="write" onSubmit={(e) => void handleSave(e)}>
                  <label htmlFor="sentence">Write your sentence</label>
                  <textarea
                    id="sentence"
                    rows={3}
                    value={sentence}
                    onChange={(e) => setSentence(e.target.value)}
                    placeholder={`Use “${word.word}” in a sentence of your own…`}
                    required
                  />
                  <div className="actions">
                    <button type="submit" className="primary" disabled={saving}>
                      {saving
                        ? "Saving…"
                        : alreadySaved
                          ? "Update sentence"
                          : "Save word"}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void handleNewWord()}
                      disabled={refreshing}
                    >
                      {refreshing ? "Loading…" : "New word"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="status">
                <p>No word loaded.</p>
                <button
                  type="button"
                  className="primary"
                  onClick={() => void handleNewWord()}
                >
                  Get a word
                </button>
              </div>
            )}

            {error && (
              <p className="toast error" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="toast success" role="status">
                {success}
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
