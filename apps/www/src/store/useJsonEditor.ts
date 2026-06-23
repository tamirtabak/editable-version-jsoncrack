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

interface JsonEditorState {
  tree: Record<string, unknown>;
  dirty: boolean;
  relations: RelationMap;
  validationErrors: ValidationResult[];
}

interface JsonEditorActions {
  loadFromJson: (json: string) => void;
  setField: (jsonPath: string, key: string, value: unknown) => void;
  addField: (jsonPath: string, key: string, value: unknown) => void;
  deleteNode: (jsonPath: string) => ValidationResult[];
  renameKey: (jsonPath: string, oldKey: string, newKey: string) => void;
  commit: () => void;
  discardDraft: () => void;
}

const useJsonEditor = create<JsonEditorState & JsonEditorActions>()((set, get) => ({
  tree: {},
  dirty: false,
  relations: new Map(),
  validationErrors: [],

  loadFromJson: (json) => {
    try {
      const tree = JSON.parse(json) as Record<string, unknown>;
      set({ tree, dirty: false, relations: buildRelationMap(tree), validationErrors: [] });
    } catch {
      // invalid json — don't overwrite
    }
  },

  setField: (jsonPath, key, value) => {
    const segments = jsonPath === "$" ? [key] : [...jsonPath.replace(/^\$\./, "").split("."), key];
    const next = setByPath(get().tree, segments, value);
    set({ tree: next, dirty: true, relations: buildRelationMap(next) });
  },

  addField: (jsonPath, key, value) => {
    const segments = jsonPath === "$" ? [] : jsonPath.replace(/^\$\./, "").split(".");
    const parent = (segments.length === 0 ? get().tree : getByPath(get().tree, segments)) as Record<string, unknown>;
    if (typeof parent !== "object" || parent === null) return;
    const updated = { ...parent, [key]: value };
    const next = segments.length === 0 ? updated : setByPath(get().tree, segments, updated);
    set({ tree: next, dirty: true, relations: buildRelationMap(next) });
  },

  renameKey: (jsonPath, oldKey, newKey) => {
    const segments = jsonPath === "$" ? [] : jsonPath.replace(/^\$\./, "").split(".");
    const parent = (segments.length === 0 ? get().tree : getByPath(get().tree, segments)) as Record<string, unknown>;
    if (!parent || !(oldKey in parent)) return;
    const reordered = Object.fromEntries(
      Object.entries(parent).map(([k, v]) => [k === oldKey ? newKey : k, v])
    );
    const next = segments.length === 0 ? reordered : setByPath(get().tree, segments, reordered);
    set({ tree: next, dirty: true });
  },

  deleteNode: (jsonPath) => {
    const issues = validateRefs(get().tree, jsonPath);
    if (issues.length > 0) {
      set({ validationErrors: issues });
      return issues;
    }
    const segments = jsonPath.replace(/^\$\./, "").split(".");
    const next = deleteByPath(get().tree, segments);
    set({ tree: next, dirty: true, relations: buildRelationMap(next), validationErrors: [] });
    return [];
  },

  commit: () => {
    const json = JSON.stringify(get().tree, null, 2);
    useFile.getState().setContents({ contents: json, hasChanges: true });
    set({ dirty: false });
  },

  discardDraft: () => {
    try {
      const json = useFile.getState().getContents();
      const tree = JSON.parse(json) as Record<string, unknown>;
      set({ tree, dirty: false, validationErrors: [] });
    } catch { /* ignore */ }
  },
}));

export default useJsonEditor;