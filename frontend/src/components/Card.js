import React from "react";
const redSuits = ["♥", "♦"];
export default function Card({ card, selected, onClick }) {
  if (!card) return null;
  if (card.value === "JOKER") {
    return (
      <span style={{
        display: "inline-block",
        padding: "8px 13px",
        marginRight: 7,
        marginBottom: 5,
        fontSize: 20,
        background: selected ? "#efe9fd" : "#faf9ff",
        border: selected ? "2px solid #915cf2" : "1px solid #aaa",
        borderRadius: 8,
        fontWeight: "bold",
        cursor: onClick ? "pointer" : undefined,
      }} onClick={onClick}>
        🃏
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-block",
      padding: "8px 13px",
      marginRight: 7,
      marginBottom: 5,
      color: redSuits.includes(card.suit) ? "crimson" : "#222",
      background: selected ? "#efe9fd" : "#faf9ff",
      border: selected ? "2px solid #915cf2" : "1px solid #aaa",
      borderRadius: 8,
      fontWeight: selected ? "bold" : "normal",
      fontSize: 20,
      cursor: onClick ? "pointer" : undefined,
    }} onClick={onClick}>{card.value}{card.suit}</span>
  );
}
