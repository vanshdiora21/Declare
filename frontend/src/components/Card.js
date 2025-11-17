import React from "react";

export default function Card({ card, selected, onClick }) {
  if (!card) return "";
  if (card.value === "JOKER") return (
    <span
      style={{
        padding: "2px 9px",
        margin: 4,
        background: selected ? "#cdb4fd" : "#faf9ff",
        border: selected ? "2px solid #915cf2" : "1px solid #aaa",
        borderRadius: 7,
        fontWeight: "bold",
        cursor: onClick ? "pointer" : undefined,
      }}
      onClick={onClick}
    >🃏</span>
  );
  const color = card.suit === "♥" || card.suit === "♦" ? "#c93" : "#111";
  return (
    <span
      style={{
        padding: "2px 9px",
        margin: 4,
        background: selected ? "#cdb4fd" : "#faf9ff",
        border: selected ? "2px solid #915cf2" : "1px solid #aaa",
        borderRadius: 7,
        color,
        fontWeight: "bold",
        cursor: onClick ? "pointer" : undefined,
      }}
      onClick={onClick}
    >
      {card.value}{card.suit}
    </span>
  );
}
