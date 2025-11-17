// src/components/ScoreBoard.js
import React from "react";
export default function ScoreBoard({ scoresTable, playerNames, totalForPlayer }) {
  return (
    <div>
      <div style={{ fontSize: 18, color: "#008080" }}>Scores Table</div>
      <table border={1} style={{ width: "100%", marginBottom: 7 }}>
        <thead>
          <tr>
            <th>R</th>
            {playerNames.map((name) => (
              <th key={name}>{name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(scoresTable || []).map((row, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              {playerNames.map((name) => (
                <td key={name}>{row[name] ?? ""}</td>
              ))}
            </tr>
          ))}
          <tr style={{ fontWeight: "bold", background: "#f2f2f2" }}>
            <td>Total</td>
            {playerNames.map((name) => (
              <td key={name}>{totalForPlayer(name)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
