import type { TreeNode } from "../types";

export function TreeView({
  node,
  depth,
  selectedId,
  onSelect,
  onOpen,
}: {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  if (node.type === "note") {
    return (
      <li>
        <button
          className={`tree-note${node.id === selectedId ? " selected" : ""}`}
          title={node.id}
          onClick={() => onSelect(node.id)}
          onDoubleClick={() => onOpen(node.id)}
        >
          {node.name.replace(/\.md$/i, "")}
        </button>
      </li>
    );
  }
  return (
    <li>
      <details className="tree-folder" open={depth < 1}>
        <summary>
          {node.name}
          <span className="tree-count">{node.noteCount}</span>
        </summary>
        <ul className="tree-list">
          {node.children.map((child) => (
            <TreeView
              key={child.id || child.name}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onOpen={onOpen}
            />
          ))}
        </ul>
      </details>
    </li>
  );
}
