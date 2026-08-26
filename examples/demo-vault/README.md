# Demo Vault

This small, fictional vault is safe to use in screenshots, demos, and tests. It contains no personal notes.

From a standalone `brain-cli` checkout:

```bash
npm run dev -- doctor "$PWD/examples/demo-vault/notes"
npm run dev -- --vault "$PWD/examples/demo-vault/notes" web --open
```

The notes use standard Markdown links and a compact PARA structure. Every note is connected so the healthy baseline is easy to recognize. A Chinese mirror is available in `notes-zh` with the same structure and whiteboard relationships.

## Whiteboard example

The demo also includes a seeded whiteboard at `notes/.brain/whiteboards/research-map.json`. It contains eight note cards and seven directed edges, so the relationship view is populated on first launch:

```text
Launch a Knowledge Toolkit -> Build a Reading Habit
Build a Reading Habit -> Knowledge Management
Knowledge Management -> Markdown Links -> Git Backups -> Local-first Principle
Knowledge Management -> Writing -> Graph Exploration
```

Try it from the repository root:

```bash
npm install
npm run build
node dist/cli.js --vault "$PWD/examples/demo-vault/notes" web --open
```

In the WebUI, open **Whiteboard**. Use **Import notes** to add notes as cards, **New card** to create a blank card, and drag the canvas or cards to arrange them. Select a card to edit its title, content, and color. Use **Connect card**, then select another card to create an edge; the edge appears as an arrow and is saved to the whiteboard JSON. The search and zoom controls filter and navigate the board without changing the source Markdown files.

The persisted edge format is intentionally small:

```json
{
  "id": "management->markdown",
  "from": "note-areas/Knowledge Management.md",
  "to": "note-resources/Markdown Links.md"
}
```

Whiteboard layout and connections are stored locally in `.brain/whiteboards`; the Markdown notes remain the source of truth.
