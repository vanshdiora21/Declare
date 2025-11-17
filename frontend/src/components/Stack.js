// src/components/Stack.js
import React from "react";
import sortCards from "../utils/sortCards";
import Card from "./Card";

export default function Stack({ stack }) {
  return (
    <div>
      {sortCards((stack || []).slice(-5)).map((card, idx) => (
        <Card key={idx} card={card} />
      ))}
    </div>
  );
}
