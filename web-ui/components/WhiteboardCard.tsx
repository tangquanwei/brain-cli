import { marked } from "marked";
import type { PointerEvent, WheelEvent } from "react";
import { navigate } from "../App";
import { useI18n } from "../i18n";
import type { WhiteboardCard } from "../types";

interface WhiteboardCardProps {
  card: WhiteboardCard;
  selected: boolean;
  editing: boolean;
  onPointerDown: (event: PointerEvent, card: WhiteboardCard) => void;
  onWheel: (event: WheelEvent) => void;
  onToggleCollapsed: (cardId: string) => void;
  onUpdate: (patch: Partial<WhiteboardCard>) => void;
}

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] ?? char,
  );

function renderFormula(source: string): string {
  let formula = escapeHtml(source.trim());
  const greek: Record<string, string> = {
    alpha: "α",
    beta: "β",
    gamma: "γ",
    delta: "δ",
    theta: "θ",
    lambda: "λ",
    mu: "μ",
    pi: "π",
    sigma: "σ",
    phi: "φ",
    omega: "ω",
    Delta: "Δ",
    Sigma: "Σ",
    Omega: "Ω",
  };
  formula = formula.replace(
    /\\frac\{([^{}]+)\}\{([^{}]+)\}/g,
    '<span class="math-frac"><span>$1</span><span>$2</span></span>',
  );
  formula = formula.replace(
    /\\([A-Za-z]+)/g,
    (_, name: string) =>
      greek[name] ??
      { sum: "∑", prod: "∏", infty: "∞", bar: "¯" }[name] ??
      name,
  );
  formula = formula
    .replace(/\^\{([^{}]+)\}/g, "<sup>$1</sup>")
    .replace(/\^([A-Za-z0-9]+)/g, "<sup>$1</sup>");
  formula = formula
    .replace(/_\{([^{}]+)\}/g, "<sub>$1</sub>")
    .replace(/_([A-Za-z0-9]+)/g, "<sub>$1</sub>");
  return formula;
}

function renderCardMarkdown(source: string): string {
  const formulas: string[] = [];
  const withPlaceholders = source.replace(
    /\$\$([\s\S]+?)\$\$|\$([^$\n]+)\$/g,
    (_match, block: string | undefined, inline: string | undefined) => {
      const index =
        formulas.push(
          block
            ? `<div class="math-block">${renderFormula(block)}</div>`
            : `<span class="math-inline">${renderFormula(inline ?? "")}</span>`,
        ) - 1;
      return `@@MATH_${index}@@`;
    },
  );
  const html = marked.parse(withPlaceholders) as string;
  return html.replace(
    /@@MATH_(\d+)@@/g,
    (_match, index: string) => formulas[Number(index)] ?? "",
  );
}

export function WhiteboardCardView({
  card,
  selected,
  editing,
  onPointerDown,
  onWheel,
  onToggleCollapsed,
  onUpdate,
}: WhiteboardCardProps) {
  const { t } = useI18n();

  return (
    <article
      className={`board-card ${card.color}${card.collapsed ? " collapsed" : ""}${selected ? " selected" : ""}${editing ? " editing" : ""}`}
      style={{ left: card.x, top: card.y }}
      onPointerDown={(event) => onPointerDown(event, card)}
      onWheel={onWheel}
    >
      <button
        className="card-collapse-toggle"
        type="button"
        aria-label={
          card.collapsed
            ? t("whiteboard.expandCard")
            : t("whiteboard.collapseCard")
        }
        title={
          card.collapsed
            ? t("whiteboard.expandCard")
            : t("whiteboard.collapseCard")
        }
        aria-expanded={!card.collapsed}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onToggleCollapsed(card.id);
        }}
      />
      {editing ? (
        <>
          <input
            className="board-card-title-input"
            value={card.title}
            placeholder={t("whiteboard.untitled")}
            autoFocus
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => onUpdate({ title: event.target.value })}
          />
          {!card.collapsed && (
            <textarea
              className="board-card-body-input"
              value={card.body}
              placeholder={t("whiteboard.emptyCard")}
              rows={5}
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => onUpdate({ body: event.target.value })}
            />
          )}
        </>
      ) : (
        <>
          <h3>{card.title || t("whiteboard.untitled")}</h3>
          {!card.collapsed && card.body ? (
            <div
              className="board-card-rendered md"
              dangerouslySetInnerHTML={{
                __html: renderCardMarkdown(card.body),
              }}
            />
          ) : !card.collapsed ? (
            <p>{t("whiteboard.emptyCard")}</p>
          ) : null}
        </>
      )}
      {!card.collapsed && card.sourceId && (
        <button
          className="card-source"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            navigate("notes", card.sourceId);
          }}
        >
          ↗ {card.sourceId}
        </button>
      )}
    </article>
  );
}
