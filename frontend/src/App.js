import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";

const valuesArr = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const redSuits = ["♥", "♦"];
function sortCards(cards) {
  const pointsMap = {
    "A": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7,
    "8": 8, "9": 9, "10": 10, J: 10, Q: 10, K: 10, "JOKER": 0
  };
  return [...cards].sort((a, b) => {
    const pa = pointsMap[a.value]; const pb = pointsMap[b.value];
    if (pa !== pb) return pa - pb;
    if (a.suit === b.suit) return valuesArr.indexOf(a.value) - valuesArr.indexOf(b.value);
    if (a.value === "JOKER") return 1;
    if (b.value === "JOKER") return -1;
    return a.suit.localeCompare(b.suit);
  });
}

function cardToString(card) {
  if (!card) return "";
  if (card.value === "JOKER") return "🃏";
  const isRed = redSuits.includes(card.suit);
  return (
    <span style={{ color: isRed ? "crimson" : "#222", fontWeight: 600 }}>
      {card.value}
      {card.suit}
    </span>
  );
}
function calcPoints(hand) {
  const pointsMap = {
    "A": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7,
    "8": 8, "9": 9, "10": 10, J: 10, Q: 10, K: 10, "JOKER": 0
  };
  return (hand || []).reduce((acc, c) => acc + pointsMap[c.value], 0);
}
function isSequence(cards) {
  if (cards.length < 3) return false;
  let noJokers = cards.filter((c) => c.value !== "JOKER");
  let jokers = cards.length - noJokers.length;
  if (noJokers.length < 2) return false;
  let suit = noJokers[0].suit;
  if (!noJokers.every((card) => card.suit === suit)) return false;
  let nums = noJokers.map((c) => valuesArr.indexOf(c.value)).sort((a, b) => a - b);
  let min = nums[0], max = nums[nums.length - 1];
  let needed = max - min + 1 - noJokers.length;
  return needed <= jokers;
}

function App() {
  const [lobby, setLobby] = useState([]);
  const [username, setUsername] = useState("");
  const [socket, setSocket] = useState(null);
  const [joined, setJoined] = useState(false);

  const [myHand, setMyHand] = useState([]);
  const [handPoints, setHandPoints] = useState(0);
  const [stack, setStack] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [pickPhase, setPickPhase] = useState(false);
  const [selectedCards, setSelectedCards] = useState([]);
  const [lastPlayedBundle, setLastPlayedBundle] = useState([]);
  const [userTurns, setUserTurns] = useState({});
  const [declareStatus, setDeclareStatus] = useState(null);
  const [scoresTable, setScoresTable] = useState([]);
  const [roundNum, setRoundNum] = useState(1);

  const [gamePointLimit, setGamePointLimit] = useState(null);
  const [proposedLimit, setProposedLimit] = useState("");
  const [reEntry, setReEntry] = useState({});
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    const newSocket = io("http://localhost:5050");
    setSocket(newSocket);

    newSocket.on("lobbyUpdate", (users) => setLobby(users || []));
    newSocket.on("yourHand", (cards) => setMyHand(cards || []));
    newSocket.on("handPoints", (points) => setHandPoints(points));
    newSocket.on("gameStart", (data) => {
      setStack(data.stack || []);
      setGameState(data);
      setCurrentTurn(data.currentTurn);
      setUserTurns(data.userTurns || {});
      setScoresTable(data.scoresTable || []);
      setRoundNum(data.roundNum || 1);
      setPickPhase(false);
      setLastPlayedBundle([]);
      setDeclareStatus(null);
      setGamePointLimit(data.gamePointLimit || null);
      setReEntry(data.reEntry || {});
      setWinner(null);
    });
    newSocket.on("turnUpdate", (data) => {
      setStack(data.stack || []);
      setCurrentTurn(data.currentTurn);
      setUserTurns(data.userTurns || {});
      setScoresTable(data.scoresTable || []);
      setRoundNum(data.roundNum || 1);
      setPickPhase(false);
      setGamePointLimit(data.gamePointLimit || null);
      setReEntry(data.reEntry || {});
    });
    newSocket.on("stackUpdate", (stack) => setStack(stack || []));
    newSocket.on("lastPlayedBundle", (bundle) => setLastPlayedBundle(bundle || []));
    newSocket.on("gameReset", () => {
      setMyHand([]);
      setHandPoints(0);
      setStack([]);
      setGameState(null);
      setCurrentTurn(null);
      setPickPhase(false);
      setSelectedCards([]);
      setLastPlayedBundle([]);
      setUserTurns({});
      setDeclareStatus(null);
      setScoresTable([]);
      setRoundNum(1);
      setGamePointLimit(null);
      setReEntry({});
      setWinner(null);
    });
    newSocket.on("yourPickPhase", ({ stack, deckCount, lastPlayedBundle }) => {
      setPickPhase(true);
      setStack(stack || []);
      setLastPlayedBundle(lastPlayedBundle || []);
    });
    newSocket.on("declareResult", (res) => {
      setDeclareStatus(res ?? null);
      if (res && res.scoresTable) setScoresTable(res.scoresTable);
      if (res && res.reEntry) setReEntry(res.reEntry);
      if (res && res.roundNum) setRoundNum(res.roundNum);
      if (res && res.winner) setWinner(res.winner);
    });
    newSocket.on("gameWinner", (win) => setWinner(win));

    return () => newSocket.disconnect();
  }, []);

  const handleJoin = () => {
    if (socket && username.trim() !== "") {
      socket.emit("joinLobby", username);
      setJoined(true);
    }
  };

  function toggleSelectCard(idx) {
    if (currentTurn === socket?.id && !pickPhase && !declareStatus) {
      if (selectedCards.includes(idx)) {
        setSelectedCards(selectedCards.filter((i) => i !== idx));
      } else {
        setSelectedCards([...selectedCards, idx]);
      }
    }
  }

  const allSameValue =
    selectedCards.length > 1 &&
    selectedCards.every(
      (idx) => myHand[idx]?.value === myHand[selectedCards[0]]?.value
    );
  const validSequence = isSequence(selectedCards.map((idx) => myHand[idx]));

  const canPlaySelected =
    selectedCards.length === 1 ||
    (selectedCards.length > 1 && allSameValue) ||
    (selectedCards.length >= 3 && validSequence);

  function playSelectedCards() {
    if (
      currentTurn === socket.id &&
      !pickPhase &&
      selectedCards.length > 0 &&
      canPlaySelected &&
      !declareStatus
    ) {
      socket.emit("playCards", {
        cards: selectedCards.map((index) => (myHand || [])[index]),
      });
      setSelectedCards([]);
    }
  }

  function pickFrom(source, cardIdx = null) {
    if (pickPhase) {
      socket.emit("pickCard", { source, cardIdx });
      setPickPhase(false);
    }
  }
  function onDeclare() {
    socket.emit("declare");
  }
  function firstPlayerPick() {
    socket.emit("firstTurnPick");
  }

  const thisPlayer = lobby.find((u) => u.name === username);
  const isDealer = thisPlayer && lobby.length && thisPlayer.id === lobby[0].id;
  const canDeclare =
    thisPlayer &&
    userTurns &&
    userTurns[thisPlayer.id] >= 2 &&
    handPoints < 15 &&
    !declareStatus &&
    !pickPhase;
  const showDeclareBtn = canDeclare && !pickPhase && currentTurn === thisPlayer?.id;
  const showPlayBtn =
    currentTurn === socket?.id &&
    !pickPhase &&
    selectedCards.length > 0 &&
    canPlaySelected &&
    !declareStatus;

  function totalForPlayer(playerName) {
    return (scoresTable || []).reduce(
      (sum, round) => sum + (round[playerName] || 0),
      0
    );
  }
  const playerNames = (lobby || []).map((u) => u.name) || [];
  const reEntryPlayers = Object.entries(reEntry || {})
    .filter(([n, v]) => v > 0)
    .map(([n]) => n);

  const showSetLimit = isDealer && !gamePointLimit && !gameState;

  return (
    <div
      style={{
        fontFamily: "sans-serif",
        minHeight: "100vh",
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          background: "#282c34",
          color: "#fff",
          padding: "16px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: "2rem", fontWeight: "bold", paddingLeft: 32 }}>
          🂡 Multiplayer Card Game
        </div>
        <div style={{ paddingRight: 32 }}>
          {gameState && (
            <div style={{ color: "#ffc107", fontWeight: 600 }}>
              Round: {roundNum} &nbsp;&nbsp;|&nbsp;&nbsp; Current turn:{" "}
              <b>{lobby.find((l) => l.id === currentTurn)?.name || "?"}</b>
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          margin: "20px 32px 0 32px",
          display: "flex",
          alignItems: "center",
        }}
      >
        {showSetLimit && (
          <>
            <input
              style={{ fontSize: 18, padding: 4, width: 120 }}
              type="number"
              placeholder="Game point limit"
              value={proposedLimit}
              onChange={(e) => setProposedLimit(e.target.value)}
            />
            <button
              style={{
                marginLeft: 10,
                fontSize: 18,
                padding: "4px 16px",
                background: "#0077ff",
                color: "#fff",
                border: 0,
                borderRadius: 4,
              }}
              onClick={() => {
                socket.emit("proposeLimit", Number(proposedLimit));
                setGamePointLimit(Number(proposedLimit));
              }}
            >
              Set Limit
            </button>
          </>
        )}
        {gamePointLimit && (
          <div style={{ fontSize: 20, marginLeft: 12 }}>
            <b>Game Point Limit: {gamePointLimit}</b>
          </div>
        )}
      </div>
      <div style={{ margin: "16px 32px" }}>
        {!joined ? (
          <div>
            <input
              placeholder="Enter your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                fontSize: "1.2rem",
                padding: 8,
                borderRadius: 4,
                border: "1px solid #888",
              }}
            />
            <button
              style={{
                marginLeft: 12,
                fontSize: "1.2rem",
                padding: "7px 20px",
                background: "#05c",
                color: "#fff",
                borderRadius: 4,
              }}
              onClick={handleJoin}
            >
              Join Lobby
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 8 }}>
              Lobby:{" "}
              {(lobby || []).map((user) => (
                <span
                  key={user?.id}
                  style={{
                    marginRight: 10,
                    fontWeight:
                      user?.id === lobby[0]?.id ? "bold" : undefined,
                  }}
                >
                  {user?.name}
                  {reEntryPlayers.includes(user.name) && (
                    <span style={{ color: "red", fontWeight: "bold" }}>
                      {" "}
                      (1 re-entry/life used)
                    </span>
                  )}
                </span>
              ))}
            </div>
            {!gameState && lobby.length >= 2 && (
              <button
                style={{
                  fontSize: 18,
                  background: "#7e3ff2",
                  color: "#fff",
                  padding: "6px 16px",
                  borderRadius: 4,
                }}
                onClick={() => socket.emit("startGame")}
              >
                Start Game
              </button>
            )}
            {gameState && (
              <div>
                <div
                  style={{
                    display: "flex",
                    gap: 44,
                    background: "#fff",
                    borderRadius: 16,
                    boxShadow: "0 1px 6px #0002",
                    padding: 22,
                    marginTop: 16,
                  }}
                >
                  {/* Your Hand area */}
                  <div style={{ flex: 2, minWidth: 350 }}>
                    <div
                      style={{
                        fontSize: 22,
                        marginBottom: 10,
                        borderBottom: "2px solid #94a3b8",
                      }}
                    >
                      🃏 Your Hand
                    </div>
                    <div style={{ minHeight: "1rem", marginBottom: 8 }}>
                      {sortCards(myHand || []).map((card, idx) => (
                        <span
                          key={idx}
                          style={{
                            display: "inline-block",
                            padding: "8px 14px",
                            marginRight: 7,
                            marginBottom: 5,
                            cursor:
                              currentTurn === socket?.id &&
                              !pickPhase &&
                              !declareStatus
                                ? "pointer"
                                : undefined,
                            borderRadius: 8,
                            border: selectedCards.includes(idx)
                              ? "2px solid #915cf2"
                              : "1px solid #aaa",
                            fontWeight: selectedCards.includes(idx)
                              ? "bold"
                              : "normal",
                            background: selectedCards.includes(idx)
                              ? "#efe9fd"
                              : "#faf9ff",
                            fontSize: 20,
                          }}
                          onClick={() => toggleSelectCard(idx)}
                        >
                          {cardToString(card)}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 18, marginBottom: 5 }}>
                      Your total points:{" "}
                      <b>{handPoints || calcPoints(myHand)}</b>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      {showPlayBtn && (
                        <button
                          style={{
                            fontSize: 17,
                            padding: "5px 18px",
                            background: "#06f",
                            color: "#fff",
                            borderRadius: 5,
                          }}
                          onClick={playSelectedCards}
                          disabled={!canPlaySelected}
                        >
                          Play Selected Cards
                        </button>
                      )}
                      {showDeclareBtn && (
                        <button
                          style={{
                            marginLeft: 16,
                            fontSize: 17,
                            padding: "5px 18px",
                            background: "#34a853",
                            color: "#fff",
                            borderRadius: 5,
                          }}
                          onClick={onDeclare}
                        >
                          Declare
                        </button>
                      )}
                    </div>
                    {gameState &&
                      !userTurns[currentTurn] &&
                      currentTurn === socket?.id && (
                        <button
                          style={{
                            marginTop: 14,
                            background: "#05c",
                            color: "#fff",
                            padding: "5px 15px",
                            borderRadius: 5,
                          }}
                          onClick={firstPlayerPick}
                        >
                          Start your turn (draw from deck)
                        </button>
                      )}
                  </div>
                  {/* Stack area */}
                  <div style={{ flex: 2, minWidth: 180 }}>
                    <div
                      style={{
                        fontSize: 22,
                        borderBottom: "2px solid #94a3b8",
                        marginBottom: 10,
                      }}
                    >
                      🗄️ Stack (last 5 cards)
                    </div>
                    <div style={{ minHeight: "1rem", marginBottom: 20 }}>
                      {sortCards((stack || []).slice(-5)).map((card, idx) => (
                        <span
                          key={idx}
                          style={{
                            display: "inline-block",
                            padding: "7px 12px",
                            fontSize: 20,
                            background: "#f4f4f8",
                            marginRight: 3,
                            borderRadius: 6,
                            marginBottom: 3,
                            border: "1px solid #eee",
                          }}
                        >
                          {cardToString(card)}
                        </span>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 16 }}>
                      <span style={{ color: "#555" }}>Last played bundle:</span>
                      <span>
                        {sortCards(lastPlayedBundle || []).map((card, idx) => (
                          <span
                            key={idx}
                            style={{
                              display: "inline-block",
                              padding: "6px 8px",
                              marginRight: 4,
                              fontSize: 19,
                              background: "#fffef7",
                              border: "1px solid #ffd",
                              borderRadius: 6,
                            }}
                          >
                            {cardToString(card)}
                          </span>
                        ))}
                      </span>
                    </div>
                    {pickPhase && (
                      <div
                        style={{
                          marginTop: 14,
                          paddingTop: 8,
                          borderTop: "1px solid #d3d3e0",
                        }}
                      >
                        <div style={{ fontWeight: "bold", marginBottom: 4 }}>
                          Pick a card
                        </div>
                        <button
                          style={{
                            background: "#2684ff",
                            padding: "5px 13px",
                            color: "#fff",
                            borderRadius: 5,
                            margin: "0 3px",
                          }}
                          onClick={() => pickFrom("deck")}
                        >
                          From Deck
                        </button>
                        <span style={{ color: "#888" }}> | </span>
                        {sortCards(lastPlayedBundle || []).map((card, idx) => (
                          <span key={idx} style={{ margin: "0 3px" }}>
                            {cardToString(card)}
                            <button
                              style={{ marginLeft: 3, padding: "2px 8px" }}
                              onClick={() => pickFrom("bundle", idx)}
                            >
                              Pick
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Score table */}
                  <div style={{ minWidth: 280, flex: 1 }}>
                    <div style={{ fontSize: 18, color: "#008080" }}>
                      Scores Table
                    </div>
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
                    <div>
                      {Object.entries(reEntry || {}).map(
                        ([name, val]) =>
                          val > 0 && (
                            <span
                              key={name}
                              style={{ color: "red", fontWeight: "bold" }}
                            >
                              {" "}
                              {name} has 1 re-entry!
                            </span>
                          )
                      )}
                    </div>
                    {winner && (
                      <div
                        style={{
                          color: "green",
                          fontWeight: "bold",
                          fontSize: 24,
                        }}
                      >
                        🏆 GAME WINNER: {winner}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {declareStatus && (
              <div
                style={{
                  background: "#fff",
                  boxShadow: "0 4px 16px #0002",
                  borderRadius: 10,
                  padding: 16,
                  margin: "30px auto 0 auto",
                  maxWidth: 640,
                }}
              >
                <h2>Declare Result (Round {declareStatus.roundNum})</h2>
                <ul>
                  {Object.entries(declareStatus.roundScore || {}).map(
                    ([name, points]) => (
                      <li key={name}>
                        {name}: {points} points
                      </li>
                    )
                  )}
                </ul>
                {declareStatus.challenged ? (
                  <div style={{ color: "red", fontWeight: "bold" }}>
                    Challenged! Someone has fewer points than the declarer.
                  </div>
                ) : (
                  <div style={{ color: "green", fontWeight: "bold" }}>
                    Congratulations! No one beat your score.
                  </div>
                )}
              </div>
            )}
            {winner && (
              <h2 style={{ color: "green", textAlign: "center" }}>
                🏆 GAME WINNER: {winner}
              </h2>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
