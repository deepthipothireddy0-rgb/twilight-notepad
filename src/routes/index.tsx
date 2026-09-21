import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FolderPlus,
  Moon,
  Plus,
  Search,
  Sparkles,
  Sun,
  Tag as TagIcon,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { summarizeNote } from "@/lib/ai.functions";
import {
  DEFAULT_FOLDER,
  createNote,
  folderList,
  loadNotes,
  matchesQuery,
  saveNotes,
  tagList,
  type Note,
} from "@/lib/notes";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Notepad — simple notes with folders, tags and AI tidy-up" },
      {
        name: "description",
        content:
          "A fast, frontend-only notepad: organize notes in folders and tags, search instantly, keep everything saved in your browser, and let AI summarize long notes.",
      },
      { property: "og:title", content: "Notepad — folders, tags and AI tidy-up" },
      {
        property: "og:description",
        content:
          "Write notes that stay in your browser. Folders, tags, instant search, light and dark themes, plus AI summaries.",
      },
    ],
  }),
  component: Index,
});

function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("notepad.theme");
    const prefers =
      stored === "dark" ||
      (stored === null && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(prefers);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    window.localStorage.setItem("notepad.theme", dark ? "dark" : "light");
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}

function Index() {
  const { dark, toggle } = useTheme();
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const summarize = useServerFn(summarizeNote);
  const firstRender = useRef(true);

  useEffect(() => {
    const stored = loadNotes();
    setNotes(stored);
    setActiveId(stored[0]?.id ?? null);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (firstRender.current) {
      firstRender.current = false;
    }
    saveNotes(notes);
  }, [notes, loaded]);

  const folders = useMemo(() => folderList(notes), [notes]);
  const tags = useMemo(() => tagList(notes), [notes]);

  const visible = useMemo(
    () =>
      notes
        .filter((n) => (folderFilter === "all" ? true : n.folder === folderFilter))
        .filter((n) => (tagFilter ? n.tags.includes(tagFilter) : true))
        .filter((n) => matchesQuery(n, query))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [notes, folderFilter, tagFilter, query],
  );

  const active = notes.find((n) => n.id === activeId) ?? null;

  function update(id: string, patch: Partial<Note>) {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
    );
  }

  function addNote() {
    const note = createNote(folderFilter === "all" ? DEFAULT_FOLDER : folderFilter);
    if (tagFilter) note.tags = [tagFilter];
    setNotes((prev) => [note, ...prev]);
    setActiveId(note.id);
  }

  function removeNote(id: string) {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      if (id === activeId) setActiveId(next[0]?.id ?? null);
      return next;
    });
    toast.success("Note deleted");
  }

  function addFolder() {
    const name = window.prompt("New folder name")?.trim();
    if (!name) return;
    setFolderFilter(name);
    const note = createNote(name);
    setNotes((prev) => [note, ...prev]);
    setActiveId(note.id);
    toast.success(`Folder "${name}" created`);
  }

  function addTag() {
    if (!active) return;
    const value = tagDraft.trim().toLowerCase();
    if (!value) return;
    if (!active.tags.includes(value)) update(active.id, { tags: [...active.tags, value] });
    setTagDraft("");
  }

  async function runAi() {
    if (!active) return;
    if (active.content.trim().length < 20) {
      toast.error("Write a bit more text first, then let AI tidy it up.");
      return;
    }
    setBusy(true);
    try {
      const result = await summarize({ data: { text: active.content } });
      const bullets = result.bullets.map((b) => `• ${b}`).join("\n");
      update(active.id, {
        title: result.title || active.title,
        content: `${result.summary}\n\n${bullets}\n\n---\nOriginal note\n${active.content}`,
        tags: Array.from(new Set([...active.tags, ...result.tags])).slice(0, 8),
      });
      toast.success("AI organized your note");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI could not organize the note");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster />
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Notepad</h1>
          <p className="text-xs text-muted-foreground">
            Saved in your browser — folders, tags and AI tidy-up
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={toggle} aria-label="Toggle theme">
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button onClick={addNote}>
            <Plus className="size-4" /> New note
          </Button>
        </div>
      </header>

      <div className="grid gap-4 p-4 md:grid-cols-[220px_260px_1fr] md:p-6">
        <aside className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Folders
              </span>
              <Button variant="ghost" size="icon" onClick={addFolder} aria-label="Add folder">
                <FolderPlus className="size-4" />
              </Button>
            </div>
            <div className="space-y-1">
              <FolderButton
                label="All notes"
                count={notes.length}
                active={folderFilter === "all"}
                onClick={() => setFolderFilter("all")}
              />
              {folders.map((f) => (
                <FolderButton
                  key={f}
                  label={f}
                  count={notes.filter((n) => n.folder === f).length}
                  active={folderFilter === f}
                  onClick={() => setFolderFilter(f)}
                />
              ))}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tags
            </span>
            {tags.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tags yet</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <button key={t} type="button" onClick={() => setTagFilter(tagFilter === t ? null : t)}>
                    <Badge variant={tagFilter === t ? "default" : "secondary"}>#{t}</Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title or content"
              className="pl-9"
            />
          </div>
          <div className="space-y-2">
            {visible.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No notes here yet. Create one to get started.
              </p>
            ) : (
              visible.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setActiveId(n.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    n.id === activeId
                      ? "border-primary bg-accent"
                      : "border-border hover:bg-accent/60"
                  }`}
                >
                  <div className="truncate text-sm font-medium">{n.title || "Untitled note"}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {n.content.trim() || "Empty note"}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                    <span>{n.folder}</span>
                    {n.tags.map((t) => (
                      <span key={t}>#{t}</span>
                    ))}
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section>
          {!active ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              Select or create a note
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2">
                <Input
                  value={active.title}
                  onChange={(e) => update(active.id, { title: e.target.value })}
                  placeholder="Note title"
                  className="text-base font-medium"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeNote(active.id)}
                  aria-label="Delete note"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={active.folder}
                  onChange={(e) => update(active.id, { folder: e.target.value })}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  aria-label="Folder"
                >
                  {folders.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <TagIcon className="size-4 text-muted-foreground" />
                  <Input
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Add tag"
                    className="h-9 w-32"
                  />
                  <Button variant="outline" size="sm" onClick={addTag}>
                    Add
                  </Button>
                </div>
                <Button size="sm" onClick={runAi} disabled={busy}>
                  <Sparkles className="size-4" />
                  {busy ? "Organizing…" : "Summarize with AI"}
                </Button>
              </div>

              {active.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {active.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1">
                      #{t}
                      <button
                        type="button"
                        aria-label={`Remove tag ${t}`}
                        onClick={() =>
                          update(active.id, { tags: active.tags.filter((x) => x !== t) })
                        }
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <Textarea
                value={active.content}
                onChange={(e) => update(active.id, { content: e.target.value })}
                placeholder="Start writing…"
                className="min-h-[360px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Last edited {new Date(active.updatedAt).toLocaleString()}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FolderButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors ${
        active ? "bg-accent font-medium" : "hover:bg-accent/60"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </button>
  );
}
