import React, { useState, useEffect } from "react";
import { Modal, Stack, TextInput, Select, Button, Group, Text, Switch } from "@mantine/core";
import { toast } from "react-hot-toast";
import useJsonEditor from "../../../../../store/useJsonEditor";

interface Props {
  opened: boolean;
  onClose: () => void;
  parentPath?: string;
}

const VALUE_TYPES = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "object", label: "Object {}" },
  { value: "array", label: "Array []" },
  { value: "null", label: "Null" },
];

interface ObjField { key: string; value: string; type: string; }

function buildValue(type: string, strVal: string, objFields: ObjField[], arrItems: ObjField[]): unknown {
  switch (type) {
    case "number": { const n = Number(strVal); return isNaN(n) ? 0 : n; }
    case "boolean": return strVal === "true";
    case "null": return null;
    case "object": {
      const obj: Record<string, unknown> = {};
      for (const f of objFields) {
        if (!f.key.trim()) continue;
        obj[f.key.trim()] = buildValue(f.type, f.value, [], []);
      }
      return obj;
    }
    case "array": return arrItems.map(i => buildValue(i.type, i.value, [], []));
    default: return strVal;
  }
}

function previewValue(type: string, strVal: string, objFields: ObjField[], arrItems: ObjField[]): string {
  try { return JSON.stringify(buildValue(type, strVal, objFields, arrItems), null, 2); }
  catch { return ""; }
}

const FieldRow = ({ field, onChange, onRemove }: {
  field: ObjField; onChange: (f: ObjField) => void; onRemove: () => void;
}) => (
  <Group gap={4} align="flex-end">
    <TextInput size="xs" placeholder="key" value={field.key} onChange={e => onChange({ ...field, key: e.currentTarget.value })} style={{ flex: 1 }} />
    <Select size="xs" data={VALUE_TYPES} value={field.type} onChange={v => onChange({ ...field, type: v ?? "string", value: "" })} style={{ width: 110 }} />
    {field.type !== "object" && field.type !== "array" && field.type !== "null" && (
      <TextInput size="xs" placeholder="value" value={field.value} onChange={e => onChange({ ...field, value: e.currentTarget.value })} style={{ flex: 1 }} />
    )}
    <Button size="xs" color="red" variant="subtle" onClick={onRemove}>✕</Button>
  </Group>
);

export const AddNodeModal = ({ opened, onClose, parentPath = "$" }: Props) => {
  const { addField, commit, tree } = useJsonEditor();
  const [key, setKey] = useState("");
  const [type, setType] = useState("string");
  const [strVal, setStrVal] = useState("");
  const [objFields, setObjFields] = useState<ObjField[]>([{ key: "", value: "", type: "string" }]);
  const [arrItems, setArrItems] = useState<ObjField[]>([{ key: "", value: "", type: "string" }]);
  const [applyToSiblings, setApplyToSiblings] = useState(false);

  // FEATURE 1: find sibling paths
  const siblingPaths = React.useMemo(() => {
    if (parentPath === "$") return [];
    const segments = parentPath.replace(/^\$\./, "").split(".");
    if (segments.length < 1) return [];
    const parentSegments = segments.slice(0, -1);
    let parentObj: unknown = tree;
    for (const s of parentSegments) {
      if (typeof parentObj !== "object" || parentObj === null) return [];
      parentObj = (parentObj as Record<string, unknown>)[s];
    }
    if (typeof parentObj !== "object" || parentObj === null || Array.isArray(parentObj)) return [];
    const siblingKey = segments[segments.length - 1];
    const siblings = Object.keys(parentObj as Record<string, unknown>).filter(k => k !== siblingKey);
    const parentPrefix = parentSegments.length === 0 ? "$" : "$." + parentSegments.join(".");
    return siblings.map(s => `${parentPrefix}.${s}`);
  }, [parentPath, tree]);

  const reset = () => {
    setKey(""); setType("string"); setStrVal("");
    setObjFields([{ key: "", value: "", type: "string" }]);
    setArrItems([{ key: "", value: "", type: "string" }]);
    setApplyToSiblings(false);
  };

  const value = buildValue(type, strVal, objFields, arrItems);
  const preview = previewValue(type, strVal, objFields, arrItems);

  const handleAdd = () => {
    if (!key.trim()) return toast.error("Key required");
    const targets = [parentPath, ...(applyToSiblings ? siblingPaths : [])];
    for (const p of targets) addField(p, key.trim(), value);
    commit();
    toast.success(`Added "${key}" to ${targets.length} node(s)`);
    reset(); onClose();
  };

  return (
    <Modal opened={opened} onClose={() => { reset(); onClose(); }} title={<Text fw={600}>Add Field</Text>} size="md" centered>
      <Stack gap="sm">
        <Text fz="xs" c="dimmed">Parent: <code>{parentPath}</code></Text>
        <TextInput label="Key" value={key} onChange={e => setKey(e.currentTarget.value)} placeholder="fieldName" />
        <Select label="Type" data={VALUE_TYPES} value={type} onChange={v => { setType(v ?? "string"); }} />

        {/* FEATURE 2: structured input per type */}
        {(type === "string" || type === "number") && (
          <TextInput label="Value" value={strVal} onChange={e => setStrVal(e.currentTarget.value)} />
        )}
        {type === "boolean" && (
          <Select label="Value" data={["true", "false"]} value={strVal || "true"} onChange={v => setStrVal(v ?? "true")} />
        )}
        {type === "object" && (
          <Stack gap={4}>
            <Text fz="xs" fw={500}>Fields</Text>
            {objFields.map((f, i) => (
              <FieldRow key={i} field={f}
                onChange={upd => setObjFields(prev => prev.map((x, j) => j === i ? upd : x))}
                onRemove={() => setObjFields(prev => prev.filter((_, j) => j !== i))}
              />
            ))}
            <Button size="xs" variant="light" onClick={() => setObjFields(p => [...p, { key: "", value: "", type: "string" }])}>+ field</Button>
          </Stack>
        )}
        {type === "array" && (
          <Stack gap={4}>
            <Text fz="xs" fw={500}>Items</Text>
            {arrItems.map((f, i) => (
              <FieldRow key={i} field={f}
                onChange={upd => setArrItems(prev => prev.map((x, j) => j === i ? upd : x))}
                onRemove={() => setArrItems(prev => prev.filter((_, j) => j !== i))}
              />
            ))}
            <Button size="xs" variant="light" onClick={() => setArrItems(p => [...p, { key: "", value: "", type: "string" }])}>+ item</Button>
          </Stack>
        )}

        {/* FEATURE 3: live preview */}
        {key.trim() && (
          <Stack gap={2}>
            <Text fz="xs" fw={500} c="dimmed">Preview</Text>
            <pre style={{ background: "var(--mantine-color-dark-7, #1a1a1a)", color: "#a3e635", borderRadius: 6, padding: 8, fontSize: 11, overflowX: "auto", maxHeight: 140, margin: 0 }}>
              {`"${key}": ${preview}`}
            </pre>
          </Stack>
        )}

        {/* FEATURE 1: apply to siblings */}
        {siblingPaths.length > 0 && (
          <Stack gap={2}>
            <Switch
              label={`Also add to ${siblingPaths.length} sibling node(s)`}
              checked={applyToSiblings}
              onChange={e => setApplyToSiblings(e.currentTarget.checked)}
              size="sm"
            />
            {applyToSiblings && (
              <Text fz="xs" c="dimmed">{siblingPaths.join(", ")}</Text>
            )}
          </Stack>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button color="green" onClick={handleAdd}>Add</Button>
        </Group>
      </Stack>
    </Modal>
  );
};