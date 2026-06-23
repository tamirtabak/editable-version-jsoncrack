// apps/www/src/features/editor/views/GraphView/overlays/EditNodeDrawer.tsx
import React, { useEffect, useState } from "react";
import {
  Drawer, Stack, TextInput, Button, Group, Text,
  ActionIcon, Divider, Badge, Alert, ScrollArea,
} from "@mantine/core";
import { MdAdd, MdDelete, MdUndo, MdEdit } from "react-icons/md";
import { toast } from "react-hot-toast";
import type { NodeData } from "jsoncrack-react";
import useJsonEditor from "../../../../../store/useJsonEditor";
import { AddNodeModal } from "./AddNodeModal";

interface Props {
  node: NodeData | null;
  opened: boolean;
  onClose: () => void;
}

function nodePath(node: NodeData): string {
  if (!node.path || node.path.length === 0) return "$";
  return "$." + node.path.map(s => String(s)).join(".");
}

export const EditNodeDrawer = ({ node, opened, onClose }: Props) => {
  const { setField, addField, renameKey, deleteNode,commit, discardDraft, validationErrors } = useJsonEditor();
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingVal, setEditingVal] = useState("");
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [addChildOpen, setAddChildOpen] = useState(false);

  useEffect(() => {
    if (opened) { setNewKey(""); setNewVal(""); setEditingKey(null); setRenameTarget(null); setLocalValues({}); }
  }, [opened, node]);

  if (!node) return null;

  const path = nodePath(node);
  const editableRows = node.text.filter(r => r.type !== "object" && r.type !== "array" && r.key);

  const handleSave = (key: string, val: string) => {
    let parsed: unknown = val;
    try { parsed = JSON.parse(val); } catch { /* keep string */ }
    setField(path, key, parsed);
	setLocalValues(prev => ({ ...prev, [key]: val }));
    setEditingKey(null);
    toast.success(`Saved "${key}"`);
  };

  const handleAdd = () => {
    if (!newKey.trim()) return toast.error("Key required");
    let parsed: unknown = newVal;
    try { parsed = JSON.parse(newVal); } catch { /* keep string */ }
    addField(path, newKey.trim(), parsed);
    setNewKey(""); setNewVal("");
    toast.success(`Added "${newKey}"`);
  };

  const handleDelete = () => {
    const issues = deleteNode(path);
    if (issues.length > 0) {
      toast.error(`Blocked: ${issues.length} ref(s) point to this node`);
    } else {
      commit();
      toast.success("Node deleted");
      onClose();
    }
  };

  const handleRename = (oldKey: string) => {
    if (!renameVal.trim()) return;
    renameKey(path, oldKey, renameVal.trim());
    setRenameTarget(null);
    toast.success(`Renamed "${oldKey}" → "${renameVal}"`);
  };

  const handleDiscard = () => { discardDraft(); toast("Discarded"); onClose(); };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={<Text fw={600} fz="sm">Edit Node — <Badge variant="light">{path}</Badge></Text>}
      position="right"
      size="md"
      overlayProps={{ opacity: 0.2 }}
    >
      <ScrollArea h="calc(100vh - 120px)" pr="xs">
        <Stack gap="sm">
          {validationErrors.length > 0 && (
            <Alert color="red" title="Ref conflict">
              {validationErrors.map((e, i) => <Text key={i} fz="xs">{e.message}</Text>)}
            </Alert>
          )}

          {/* Editable fields */}
          {editableRows.map(row => (
            <Stack key={row.key} gap={4}>
              <Group justify="space-between">
                {renameTarget === row.key ? (
                  <Group gap={4} flex={1}>
                    <TextInput
                      size="xs"
                      value={renameVal}
                      onChange={e => setRenameVal(e.currentTarget.value)}
                      placeholder="New key name"
                      style={{ flex: 1 }}
                    />
                    <Button size="xs" onClick={() => handleRename(row.key!)} compact>OK</Button>
                    <Button size="xs" variant="subtle" onClick={() => setRenameTarget(null)} compact>✕</Button>
                  </Group>
                ) : (
                  <Group gap={4}>
                    <Text fz="xs" fw={500} c="dimmed">{row.key}</Text>
                    <ActionIcon size="xs" variant="subtle" onClick={() => { setRenameTarget(row.key!); setRenameVal(row.key!); }}>
                      <MdEdit size={10} />
                    </ActionIcon>
                  </Group>
                )}
                <ActionIcon
                  size="xs"
                  color="red"
                  variant="subtle"
                  onClick={() => { deleteNode(`${path}.${row.key}`); commit(); toast.success(`Deleted "${row.key}"`); }}
                >
                  <MdDelete size={12} />
                </ActionIcon>
              </Group>
              {editingKey === row.key ? (
                <Group gap={4}>
                  <TextInput
                    size="xs"
                    value={editingVal}
                    onChange={e => setEditingVal(e.currentTarget.value)}
                    style={{ flex: 1 }}
                  />
                  <Button size="xs" onClick={() => handleSave(row.key!, editingVal)}>Save</Button>
                  <Button size="xs" variant="subtle" onClick={() => setEditingKey(null)}>✕</Button>
                </Group>
              ) : (
                <Text
                  fz="xs"
                  style={{ cursor: "pointer", fontFamily: "monospace" }}
                  onClick={() => { setEditingKey(row.key!); setEditingVal(String(row.value ?? "")); }}
                  c="blue.6"
                >
				{localValues[row.key!] !== undefined ? localValues[row.key!] : String(row.value ?? "null")}
                </Text>
              )}
            </Stack>
          ))}

          <Divider label="Add field to this node" />
          <Group gap={4} align="flex-end">
            <TextInput size="xs" label="Key" value={newKey} onChange={e => setNewKey(e.currentTarget.value)} style={{ flex: 1 }} />
            <TextInput size="xs" label="Value" value={newVal} onChange={e => setNewVal(e.currentTarget.value)} style={{ flex: 1 }} />
            <ActionIcon onClick={handleAdd} color="green" variant="filled" size="md">
              <MdAdd />
            </ActionIcon>
          </Group>
		  
		  <Button size="xs" variant="light" color="blue" onClick={() => setAddChildOpen(true)}>
            + Add child node (object/array)
          </Button>
          <Divider />
          <Group gap="xs">
            <Button size="xs" leftSection={<MdUndo />} onClick={handleDiscard} variant="default">Discard</Button>
            <Button size="xs" color="red" variant="subtle" onClick={handleDelete}>Delete Node</Button>
          </Group>
        </Stack>
      </ScrollArea>
	  <AddNodeModal opened={addChildOpen} onClose={() => setAddChildOpen(false)} parentPath={path} />
    </Drawer>
  );
};