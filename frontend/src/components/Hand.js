import React from "react";
import Card from "./Card";

export default function Hand({ hand, selectedCards, onCardClick }) {
  return (
    <div>
      {hand.map((card, idx) => (
        <Card
          key={idx}
          card={card}
          selected={selectedCards.includes(idx)}
          onClick={() => onCardClick(idx)}
        />
      ))}
    </div>
  );
}
