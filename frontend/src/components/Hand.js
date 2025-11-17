import React from "react";
import sortCards from "../utils/sortCards";
import Card from "./Card";

export default function Hand({ hand, selectedCards, toggleSelectCard }) {
  return (
    <div>
      {sortCards(hand).map((card, idx) => (
        <Card
          key={idx}
          card={card}
          selected={selectedCards.includes(idx)}
          onClick={() => toggleSelectCard(idx)}
        />
      ))}
    </div>
  );
}
