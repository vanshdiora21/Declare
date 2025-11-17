import React from "react";
import Card from "./Card";

export default function Stack({ stack, lastPlayedBundle }) {
  return (
    <div>
      <div>
        Stack top:{" "}
        {(stack || []).slice(-3).map((card, idx) => (
          <Card card={card} key={idx} />
        ))}
      </div>
      <div>
        Last played bundle:{" "}
        {(lastPlayedBundle || []).map((card, idx) => (
          <Card card={card} key={idx} />
        ))}
      </div>
    </div>
  );
}
