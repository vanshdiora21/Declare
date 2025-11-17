import React from "react";
export default function ScoresTable({ rounds, playerNames, totalForPlayer }) {
  return (
    <table border={1}>
      <thead>
        <tr>
          <th>Round</th>
          {playerNames.map(name => <th key={name}>{name}</th>)}
        </tr>
      </thead>
      <tbody>
        {(rounds || []).map((row, i) => (
          <tr key={i}>
            <td>{i+1}</td>
            {playerNames.map(name => <td key={name}>{row[name] ?? ""}</td>)}
          </tr>
        ))}
        <tr style={{ fontWeight:"bold", background:"#f2f2f2" }}>
          <td>Total</td>
          {playerNames.map(name => <td key={name}>{totalForPlayer(name)}</td>)}
        </tr>
      </tbody>
    </table>
  );
}
