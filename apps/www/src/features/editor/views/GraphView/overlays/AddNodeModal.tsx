import React, { useState } from "react";
import { Modal, Stack, TextInput, Select, Button, Group, Text, JsonInput } from "@mantine/core";
import { toast } from "react-hot-toast";
import useJsonEditor from "../../../../../store/useJsonEditor";

interface Props {
  opened: boolean;
  onClose: () => void;
  parentPath?: string; // "$" or "$.some.path"
}

const VALUE_TYPES = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "object", label: "Object {}" },
  { value: "array", label: "Array []" },
  { value: "null", label: "Null" },
];

function defaultForType(t: string): unknown {
  switch (t) {
    case "number": return 0;
    case "boolean": return false;
    case "object": return {};
    case "array": return [];
    case "null": return null;
    default: return "";
  }
}

export const AddNodeModal = ({ opened, onClose, parentPath = "$" }: Props) => {
  const { addField, commit } = useJsonEditor();
  const [key, setKey] = useState("");
  const [type, setType] = useState("string");
  const [strVal, setStrVal] = useState("");
  const [jsonVal, setJsonVal] = useState("{}");
  const [jsonErr, setJsonErr] = useState<string | null>(null);

  const reset = () => { setKey(""); setType("string"); setStrVal(""); setJsonVal("{}"); setJsonErr(null); };

  const handleAdd = () => {
    if (!key.trim()) return toast.error("Key is required");
    let value: unknown;
    if (type === "object" || type === "array") {
      try { value = JSON.parse(jsonVal); } catch (e: unknown) {
        setJsonErr((e as Error).message); return;
      }
    } else if (type === "string") {
      value = strVal;
    } else {
      value = defaultForType(type);
      if (type === "number") { const n = Number(strVal); value = isNaN(n) ? 0 : n; }
      if (type === "boolean") { value = strVal === "true"; }
    }
    addField(parentPath, key.trim(), value);
    commit();
    toast.success(`Added "${key}" to ${parentPath}`);
    reset(); onClose();
  };

  return (
    <Modal opened={opened} onClose={() => { reset(); onClose(); }} title={<Text fw={600}>Add Node</Text>} centered>
      <Stack gap="sm">
        <Text fz="xs" c="dimmed">Parent: <code>{parentPath}</code></Text>
        <TextInput label="Key" value={key} onChange={e => setKey(e.currentTarget.value)} placeholder="fieldName" />
        <Select label="Type" data={VALUE_TYPES} value={type} onChange={v => { setType(v ?? "string"); setJsonErr(null); }} />
        {(type === "string" || type === "number" || type === "boolean") && (
          <TextInput
            label="Value"
            value={strVal}
            onChange={e => setStrVal(e.currentTarget.value)}
            placeholder={type === "boolean" ? "true / false" : type === "number" ? "0" : "value"}
          />
        )}
        {(type === "object" || type === "array") && (
          <JsonInput
            label="Value (JSON)"
            value={jsonVal}
            onChange={v => { setJsonVal(v); setJsonErr(null); }}
            error={jsonErr}
            formatOnBlur
            autosize
            minRows={3}
          />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button color="green" onClick={handleAdd}>Add</Button>
        </Group>
      </Stack>
    </Modal>
  );
};