import React, { useEffect, useMemo, useState } from "react";
import {
  ReactFlow, Background, Controls, useNodesState, useEdgesState, MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// The End to End flow diagram (rule 5 + 17): boxes and edges come from the server's
// diagram-studio/1 data (loaded by name, no hand-built nodes here). Boxes are movable, Reset
// restores the served positions, speed controls the simulated pacing of the active hop.
const GROUP_TOKEN = {
  blue: "var(--box-blue)",
  red: "var(--box-red)",
  grey: "var(--box-grey)",
  dark: "var(--box-dark)",
};

function boxStyle(color) {
  return {
    background: GROUP_TOKEN[color] || "var(--box-dark)",
    color: "var(--on-box)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 12,
    width: 150,
  };
}

export default function FlowDiagram({ diagram, activePath, blocked, speed, onReset }) {
  const [version, setVersion] = useState(0);
  const layout = useMemo(() => {
    if (!diagram) return { nodes: [], edges: [] };
    const nodes = diagram.nodes.map((n) => ({
      id: n.id,
      position: { x: (n.x ?? 0) * 250, y: (n.y ?? 0) * 140 },
      data: { label: <div><strong>{n.label}</strong>{(n.sub || []).map((s, i) => <div key={i} className="flow-sub">{s}</div>)}</div> },
      style: boxStyle(diagram.groups?.[n.group]?.color),
      draggable: true,
    }));
    const pathHops = new Set((diagram.paths || []).find((p) => p.id === activePath)?.hops || []);
    const edges = diagram.edges.map((e) => {
      const onPath = activePath && pathHops.has(e.from) && pathHops.has(e.to);
      return {
        id: e.id,
        source: e.from,
        target: e.to,
        label: e.label,
        animated: Boolean(onPath) && !blocked,
        style: {
          stroke: onPath ? (blocked ? "var(--danger-text)" : "var(--accent)") : "var(--muted)",
          strokeWidth: onPath ? 2.5 : 1.5,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: onPath ? (blocked ? "var(--danger-text)" : "var(--accent)") : "var(--muted)" },
      };
    });
    return { nodes, edges };
  }, [diagram, activePath, blocked]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, , onEdgesChange] = useEdgesState(layout.edges);
  useEffect(() => { setNodes(layout.nodes); setVersion((v) => v + 1); }, [layout, setNodes]);

  return (
    <div className="flow" data-testid="flow" data-active-path={activePath || ""} data-blocked={blocked ? "1" : "0"} data-speed={speed} key={version}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable={false}
        aria-label="End-to-end request flow diagram"
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
      <button type="button" className="btn small" data-testid="flow-reset" onClick={() => { setNodes(layout.nodes); setVersion((v) => v + 1); onReset?.(); }}>Reset layout</button>
    </div>
  );
}
