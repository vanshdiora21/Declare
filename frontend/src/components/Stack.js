import React from "react";
import sortCards from "../utils/sortCards";
import Card from "./Card";


export default function Stack({ playedBundles }) {
  return (
    <div>
      {(playedBundles || []).slice(-5).map((bundleObj, idx) =>
        <span key={idx} style={{ display: "inline-block", marginRight: 12 }}>
          {bundleObj.bundle.map((card, cidx) => (
            <Card card={card} key={cidx} />
          ))}
        </span>
      )}
    </div>
  );
}
