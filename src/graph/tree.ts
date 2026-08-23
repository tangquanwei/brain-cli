import type { NoteNode } from "../utils/noteIndex.js";

export interface DirectoryFileNode {
  type: "note";
  name: string;
  id: string;
}

export interface DirectoryFolderNode {
  type: "folder" | "root";
  name: string;
  id: string;
  noteCount: number;
  children: Array<DirectoryFolderNode | DirectoryFileNode>;
}

interface MutableFolder {
  name: string;
  id: string;
  folders: Map<string, MutableFolder>;
  notes: DirectoryFileNode[];
}

function finalize(folder: MutableFolder, root = false): DirectoryFolderNode {
  const folders = [...folder.folders.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
    .map((child) => finalize(child));
  const notes = folder.notes.sort((a, b) =>
    a.name.localeCompare(b.name, "zh-CN"),
  );
  return {
    type: root ? "root" : "folder",
    name: folder.name,
    id: folder.id,
    noteCount:
      notes.length +
      folders.reduce((total, child) => total + child.noteCount, 0),
    children: [...folders, ...notes],
  };
}

export function buildDirectoryTree(nodes: NoteNode[]): DirectoryFolderNode {
  const root: MutableFolder = {
    name: "notes",
    id: "",
    folders: new Map(),
    notes: [],
  };

  for (const node of nodes) {
    const parts = node.relPath.split("/");
    const filename = parts.pop();
    if (!filename) continue;
    let current = root;
    for (const part of parts) {
      const id = current.id ? `${current.id}/${part}` : part;
      let child = current.folders.get(part);
      if (!child) {
        child = { name: part, id, folders: new Map(), notes: [] };
        current.folders.set(part, child);
      }
      current = child;
    }
    current.notes.push({ type: "note", name: filename, id: node.relPath });
  }

  return finalize(root, true);
}
