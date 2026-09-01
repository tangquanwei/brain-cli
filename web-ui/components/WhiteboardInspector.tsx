import { navigate } from "../App";
import { useI18n } from "../i18n";
import type { WhiteboardCard, WhiteboardEdge } from "../types";

interface WhiteboardInspectorProps {
  selected: WhiteboardCard | null;
  selectedEdges: WhiteboardEdge[];
  cardById: Map<string, WhiteboardCard>;
  inspectorCollapsed: boolean;
  connectingFrom: string | null;
  onClose: () => void;
  onUpdate: (patch: Partial<WhiteboardCard>) => void;
  onToggleConnect: () => void;
  onRemoveEdge: (edgeId: string) => void;
  onDelete: () => void;
}

export function WhiteboardInspector({
  selected,
  selectedEdges,
  cardById,
  inspectorCollapsed,
  connectingFrom,
  onClose,
  onUpdate,
  onToggleConnect,
  onRemoveEdge,
  onDelete,
}: WhiteboardInspectorProps) {
  const { t } = useI18n();

  return (
    <aside
      className={`whiteboard-inspector${selected ? " open" : ""}${inspectorCollapsed ? " collapsed" : ""}`}
    >
      <div className="inspector-content">
        {selected ? (
          <>
            <div className="inspector-head">
              <span>{t("whiteboard.editCard")}</span>
              <button
                className="icon-btn"
                onClick={onClose}
                aria-label={t("whiteboard.close")}
              >
                ×
              </button>
            </div>
            <label className="inspector-label">{t("whiteboard.title")}</label>
            <input
              value={selected.title}
              onChange={(event) => onUpdate({ title: event.target.value })}
            />
            <label className="inspector-label">{t("whiteboard.content")}</label>
            <textarea
              value={selected.body}
              onChange={(event) => onUpdate({ body: event.target.value })}
              rows={8}
            />
            <label className="inspector-label">{t("whiteboard.color")}</label>
            <div className="color-picker">
              {(["blue", "yellow", "green", "pink"] as const).map((color) => (
                <button
                  key={color}
                  className={`color-swatch ${color}${selected.color === color ? " active" : ""}`}
                  onClick={() => onUpdate({ color })}
                  aria-label={color}
                />
              ))}
            </div>
            {selected.sourceId && (
              <button
                className="btn inspector-source"
                onClick={() => navigate("notes", selected.sourceId)}
              >
                {t("whiteboard.openNote")}
              </button>
            )}
            <button
              className={`btn inspector-source${connectingFrom === selected.id ? " primary" : ""}`}
              onClick={onToggleConnect}
            >
              {connectingFrom === selected.id
                ? t("whiteboard.cancelConnect")
                : t("whiteboard.connect")}
            </button>
            {connectingFrom === selected.id && (
              <p className="connect-hint">{t("whiteboard.connecting")}</p>
            )}
            <div className="connection-section">
              <div className="inspector-label">
                {t("whiteboard.connections")}
              </div>
              {selectedEdges.length === 0 ? (
                <div className="connection-empty">
                  {t("whiteboard.noConnections")}
                </div>
              ) : (
                selectedEdges.map((edge) => {
                  const outgoing = edge.from === selected.id;
                  const other = cardById.get(outgoing ? edge.to : edge.from);
                  return (
                    <div className="connection-row" key={edge.id}>
                      <span className="connection-direction">
                        {outgoing ? "→" : "←"}
                      </span>
                      <span className="connection-name">
                        {other?.title || t("whiteboard.untitled")}
                      </span>
                      <button
                        className="connection-remove"
                        onClick={() => onRemoveEdge(edge.id)}
                        aria-label={t("whiteboard.removeConnection")}
                      >
                        ×
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            <button className="btn danger inspector-delete" onClick={onDelete}>
              {t("whiteboard.delete")}
            </button>
          </>
        ) : (
          <div className="inspector-empty">
            <div className="inspector-icon">✦</div>
            <strong>{t("whiteboard.selectCard")}</strong>
            <p>{t("whiteboard.selectHint")}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
