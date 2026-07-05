// apps/www/src/store/useJsonEditor.ts
import { create } from "zustand";
import useFile from "./useFile";

export type RelationMap = Map<string, Set<string>>;

export interface ValidationResult {
  path: string;
  message: string;
}

function buildRelationMap(obj: unknown, map: RelationMap = new Map(), parentPath = "$"): RelationMap {
  if (typeof obj !== "object" || obj === null) return map;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = `${parentPath}.${k}`;
    if (typeof v === "string" && (k === "$ref" || k === "ref" || k === "id")) {
      const refs = map.get(v) ?? new Set();
      refs.add(path);
      map.set(v, refs);
    }
    buildRelationMap(v, map, path);
  }
  return map;
}

export function validateRefs(tree: unknown, deletePath: string): ValidationResult[] {
  const issues: ValidationResult[] = [];
  // find id value at deletePath
  const segment = deletePath.split(".").slice(1);
  let node: unknown = tree;
  for (const s of segment) {
    if (typeof node !== "object" || node === null) break;
    node = (node as Record<string, unknown>)[s];
  }
  const idVal = typeof node === "object" && node !== null
    ? (node as Record<string, unknown>)["id"]
    : null;

  if (!idVal) return issues;

  // scan tree for refs pointing to this id
  const scanRefs = (obj: unknown, path = "$") => {
    if (typeof obj !== "object" || obj === null) return;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const p = `${path}.${k}`;
      if ((k === "$ref" || k === "ref") && v === idVal) {
        issues.push({ path: p, message: `Ref to deleted id "${idVal}" at ${p}` });
      }
      scanRefs(v, p);
    }
  };
  scanRefs(tree);
  return issues;
}

function getByPath(obj: Record<string, unknown>, segments: string[]): unknown {
  let cur: unknown = obj;
  for (const s of segments) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[s];
  }
  return cur;
}

function setByPath(
  obj: Record<string, unknown>,
  segments: string[],
  value: unknown
): Record<string, unknown> {
  if (segments.length === 0) return value as Record<string, unknown>;
  const [head, ...tail] = segments;
  const current = (obj[head] ?? {}) as Record<string, unknown>;
  return { ...obj, [head]: tail.length === 0 ? value : setByPath(current, tail, value) };
}

function deleteByPath(
  obj: Record<string, unknown>,
  segments: string[]
): Record<string, unknown> {
  if (segments.length === 0) return obj;
  const [head, ...tail] = segments;
  if (tail.length === 0) {
    const next = { ...obj };
    delete next[head];
    return next;
  }
  return {
    ...obj,
    [head]: deleteByPath((obj[head] ?? {}) as Record<string, unknown>, tail),
  };
}

export type ChangeType = "add" | "modify" | "delete";
export interface PendingChange { path: string; type: ChangeType; }

interface JsonEditorState {
  tree: Record<string, unknown>;
  dirty: boolean;
  relations: RelationMap;
  validationErrors: ValidationResult[];
  history: Record<string, unknown>[];
  historyIndex: number;
  pendingChanges: PendingChange[];
}

interface JsonEditorActions {
  loadFromJson: (json: string) => void;
  setField: (jsonPath: string, key: string, value: unknown) => void;
  addField: (jsonPath: string, key: string, value: unknown) => void;
  deleteNode: (jsonPath: string) => ValidationResult[];
  renameKey: (jsonPath: string, oldKey: string, newKey: string) => void;
  commit: () => void;
  discardDraft: () => void;
  undo: () => void;
  redo: () => void;
}

function pushHistory(state: JsonEditorState, next: Record<string, unknown>): Partial<JsonEditorState> {
  const sliced = state.history.slice(0, state.historyIndex + 1);
  return { history: [...sliced, next], historyIndex: sliced.length };
}

export const useJsonEditor = create<JsonEditorState & JsonEditorActions>()((set, get) => ({
  tree: {},
  dirty: false,
  relations: new Map(),
  validationErrors: [],
  history: [{}],
  historyIndex: 0,
  pendingChanges: [],

  loadFromJson: (json) => {
    try {
      const tree = JSON.parse(json) as Record<string, unknown>;
      set({ tree, dirty: false, relations: buildRelationMap(tree), validationErrors: [], history: [tree], historyIndex: 0 });
    } catch {}
  },

  setField: (jsonPath, key, value) => {
    const s = get();
    const segments = jsonPath === "$" ? [key] : [...jsonPath.replace(/^\$\./, "").split("."), key];
    const next = setByPath(s.tree, segments, value);
    const fullPath = segments.join(".");
    const existing = s.pendingChanges.find(c => c.path === fullPath);
    const pendingChanges = existing
      ? s.pendingChanges.map(c => c.path === fullPath ? { ...c, type: "modify" as ChangeType } : c)
      : [...s.pendingChanges, { path: fullPath, type: "modify" as ChangeType }];
    set({ tree: next, dirty: true, relations: buildRelationMap(next), pendingChanges, ...pushHistory(s, next) });
  },

  addField: (jsonPath, key, value) => {
    const s = get();
    const segments = jsonPath === "$" ? [] : jsonPath.replace(/^\$\./, "").split(".");
    const parent = (segments.length === 0 ? s.tree : getByPath(s.tree, segments)) as Record<string, unknown>;
    if (typeof parent !== "object" || parent === null) return;
    const updated = { ...parent, [key]: value };
    const next = segments.length === 0 ? updated : setByPath(s.tree, segments, updated);
    const fullPath = [...segments, key].join(".");
    set({ tree: next, dirty: true, relations: buildRelationMap(next),
      pendingChanges: [...s.pendingChanges, { path: fullPath, type: "add" }], ...pushHistory(s, next) });
  },

  renameKey: (jsonPath, oldKey, newKey) => {
    const s = get();
    const segments = jsonPath === "$" ? [] : jsonPath.replace(/^\$\./, "").split(".");
    const parent = (segments.length === 0 ? s.tree : getByPath(s.tree, segments)) as Record<string, unknown>;
    if (!parent || !(oldKey in parent)) return;
    const reordered = Object.fromEntries(
      Object.entries(parent).map(([k, v]) => [k === oldKey ? newKey : k, v])
    );
    const next = segments.length === 0 ? reordered : setByPath(s.tree, segments, reordered);
    const fullPath = [...segments, newKey].join(".");
    set({ tree: next, dirty: true,
      pendingChanges: [...s.pendingChanges, { path: fullPath, type: "modify" }], ...pushHistory(s, next) });
  },

  deleteNode: (jsonPath) => {
    const s = get();
    const issues = validateRefs(s.tree, jsonPath);
    if (issues.length > 0) { set({ validationErrors: issues }); return issues; }
    const segments = jsonPath.replace(/^\$\./, "").split(".");
    const next = deleteByPath(s.tree, segments);
    const fullPath = segments.join(".");
    set({ tree: next, dirty: true, relations: buildRelationMap(next), validationErrors: [],
      pendingChanges: [...s.pendingChanges, { path: fullPath, type: "delete" }], ...pushHistory(s, next) });
    return [];
  },

  commit: () => {
    const json = JSON.stringify(get().tree, null, 2);
    useFile.getState().setContents({ contents: json, hasChanges: true });
    set({ dirty: false, pendingChanges: [] });
  },

  discardDraft: () => {
    try {
      const json = useFile.getState().getContents();
      const tree = JSON.parse(json) as Record<string, unknown>;
      set({ tree, dirty: false, validationErrors: [], history: [tree], historyIndex: 0, pendingChanges: [] });
    } catch {}
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const idx = historyIndex - 1;
    const tree = history[idx];
    const json = JSON.stringify(tree, null, 2);
    useFile.getState().setContents({ contents: json, hasChanges: true });
    set({ tree, historyIndex: idx, dirty: idx > 0, relations: buildRelationMap(tree) });
  },

 redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const idx = historyIndex + 1;
    const tree = history[idx];
    const json = JSON.stringify(tree, null, 2);
    useFile.getState().setContents({ contents: json, hasChanges: true });
    set({ tree, historyIndex: idx, dirty: true, relations: buildRelationMap(tree) });
  },
}));

export { useJsonEditor as default };