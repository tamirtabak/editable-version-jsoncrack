import React from "react";
import useJsonEditor from "../../../../../store/useJsonEditor";
import useGraph from "../stores/useGraph";

// Overlay that renders colored boxes on graph nodes based on pendingChanges.
// Relies on data-node-id attributes set by reaflow/jsoncrack-react on SVG nodes.

export const ChangeHighlightOverlay = () => {
  const editMode = useGraph(state => state.editMode);
  const { pendingChanges, dirty } = useJsonEditor();

  if (!editMode || !dirty || pendingChanges.length === 0) return null;

  return (
    <>
      {pendingChanges.map((change, i) => {
        const color = change.type === "delete"
          ? "rgba(239,68,68,0.18)"
          : change.type === "add"
            ? "rgba(34,197,94,0.18)"
            : "rgba(59,130,246,0.18)";
        const border = change.type === "delete"
          ? "1.5px solid rgba(239,68,68,0.6)"
          : change.type === "add"
            ? "1.5px solid rgba(34,197,94,0.6)"
            : "1.5px solid rgba(59,130,246,0.6)";

        // find DOM node by path label
        const el = document.querySelector(`[data-path="${change.path}"]`) as HTMLElement | null;
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const parentRect = el.closest(".graph-canvas, svg")?.getBoundingClientRect();
        if (!parentRect) return null;

        return (
          <div key={i} style={{
            position: "absolute",
            top: rect.top - parentRect.top - 4,
            left: rect.left - parentRect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            background: color,
            border,
            borderRadius: 6,
            pointerEvents: "none",
            zIndex: 10,
            transition: "all 5s",
          }} />
        );
      })}
    </>
  );
};