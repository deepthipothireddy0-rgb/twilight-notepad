export type Note = {
  id: string;
  title: string;
  content: string;
  folder: string;
  tags: string[];
  updatedAt: number;
};

export const STORAGE_KEY = "notepad.notes.v1";
export const THEME_KEY = "notepad.theme";
export const DEFAULT_FOLDER = "General";

export function createNote(folder = DEFAULT_FOLDER): Note {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now() + Math.random()),
    title: "Untitled note",
    content: "",
    folder,
    tags: [],
    updatedAt: Date.now(),
  };
}

export function loadNotes(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((n) => n && typeof n.id === "string")
      .map((n) => ({
        id: n.id,
        title: typeof n.title === "string" ? n.title : "Untitled note",
        content: typeof n.content === "string" ? n.content : "",
        folder: typeof n.folder === "string" && n.folder ? n.folder : DEFAULT_FOLDER,
        tags: Array.isArray(n.tags) ? n.tags.filter((t: unknown) => typeof t === "string") : [],
        updatedAt: typeof n.updatedAt === "number" ? n.updatedAt : Date.now(),
      })) as Note[];
  } catch {
    return [];
  }
}

export function saveNotes(notes: Note[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    /* storage full or unavailable */
  }
}

export function matchesQuery(note: Note, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    note.title.toLowerCase().includes(q) ||
    note.content.toLowerCase().includes(q) ||
    note.tags.some((t) => t.toLowerCase().includes(q))
  );
}

export function folderList(notes: Note[]) {
  const set = new Set<string>([DEFAULT_FOLDER]);
  notes.forEach((n) => set.add(n.folder));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function tagList(notes: Note[]) {
  const set = new Set<string>();
  notes.forEach((n) => n.tags.forEach((t) => set.add(t)));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
