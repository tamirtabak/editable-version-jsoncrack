import React, { useState } from "react";
import {
  Modal, Stack, Text, Button, Group, Card, SimpleGrid,
  Textarea, Tabs, TextInput,
} from "@mantine/core";
import { toast } from "react-hot-toast";
import useFile from "../../../../../store/useFile";

const TEMPLATES: Record<string, { label: string; description: string; json: object }> = {
  blank: {
    label: "Blank",
    description: "Empty object",
    json: {},
  },
  keyValue: {
    label: "Key-Value Store",
    description: "Simple flat key-value pairs",
    json: { key1: "value1", key2: "value2", key3: 42 },
  },
  entity: {
    label: "Entity",
    description: "Object with id + metadata",
    json: { id: "entity-001", name: "", type: "", createdAt: "", updatedAt: "", metadata: {} },
  },
  ontologyClass: {
    label: "OWL Class",
    description: "Ontology class node",
    json: {
      id: "class-001", label: "ClassName", type: "owl:Class",
      subClassOf: null, properties: [], restrictions: [],
      annotations: { comment: "", seeAlso: "" },
    },
  },
  ontologyProperty: {
    label: "OWL Property",
    description: "Object/data property",
    json: {
      id: "prop-001", label: "", type: "owl:ObjectProperty",
      domain: null, range: null, characteristics: [],
    },
  },
  graph: {
    label: "Graph",
    description: "Nodes + edges structure",
    json: {
      nodes: [{ id: "n1", label: "Node 1" }, { id: "n2", label: "Node 2" }],
      edges: [{ id: "e1", from: "n1", to: "n2", label: "" }],
    },
  },
};

interface Props { opened: boolean; onClose: () => void; }

export const TemplatesModal = ({ opened, onClose }: Props) => {
  const { setContents } = useFile();
  const [tab, setTab] = useState<string>("templates");
  const [raw, setRaw] = useState("{}");
  const [rawErr, setRawErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const applyTemplate = (json: object) => {
    setContents({ contents: JSON.stringify(json, null, 2), hasChanges: true });
    toast.success("Template applied");
    onClose();
  };

  const applyRaw = () => {
    try {
      JSON.parse(raw);
      setContents({ contents: raw, hasChanges: true });
      toast.success("JSON loaded");
      onClose();
    } catch (e: unknown) { setRawErr((e as Error).message); }
  };

  const filtered = Object.entries(TEMPLATES).filter(
    ([, v]) => v.label.toLowerCase().includes(filter.toLowerCase()) ||
               v.description.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={600}>New / Templates</Text>} size="lg" centered>
      <Tabs value={tab} onChange={v => setTab(v ?? "templates")}>
        <Tabs.List>
          <Tabs.Tab value="templates">Templates</Tabs.Tab>
          <Tabs.Tab value="paste">Paste JSON</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="templates" pt="sm">
          <Stack gap="sm">
            <TextInput placeholder="Search templates..." value={filter} onChange={e => setFilter(e.currentTarget.value)} size="xs" />
            <SimpleGrid cols={2} spacing="xs">
              {filtered.map(([k, t]) => (
                <Card key={k} withBorder padding="xs" style={{ cursor: "pointer" }} onClick={() => applyTemplate(t.json)}>
                  <Text fw={600} fz="sm">{t.label}</Text>
                  <Text fz="xs" c="dimmed">{t.description}</Text>
                </Card>
              ))}
            </SimpleGrid>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="paste" pt="sm">
          <Stack gap="sm">
            <Textarea
              label="Paste JSON"
              value={raw}
              onChange={e => { setRaw(e.currentTarget.value); setRawErr(null); }}
              error={rawErr}
              autosize minRows={8} maxRows={16}
              styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
            />
            <Group justify="flex-end">
              <Button onClick={applyRaw} color="green">Load</Button>
            </Group>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
};