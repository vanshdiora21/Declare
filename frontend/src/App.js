import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import Hand from "./components/Hand";
import Stack from "./components/Stack";
import ScoresTable from "./components/ScoresTable";

function cardToString(card) {
  if (!card) return "";
  if (card.value === "JOKER") return "🃏";
  return `${card.value}${card.suit}`;
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
  let valuesArr = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  let noJokers = cards.filter(c => c.value !== "JOKER");
  let jokers = cards.length - noJokers.length;
  if (noJokers.length < 2) return false;
  let suit = noJokers[0].suit;
  if (!noJokers.every(card => card.suit === suit)) return false;
  let nums = noJokers.map(c => valuesArr.indexOf(c.value)).sort((a,b)=>a-b);
  let min = nums[0], max = nums[nums.length-1];
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
  const [limitVoters, setLimitVoters] = useState({});
  const [reEntry, setReEntry] = useState({});
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    const newSocket = io("http://localhost:5050");
    setSocket(newSocket);

    newSocket.on("lobbyUpdate", users => setLobby(users || []));
    newSocket.on("yourHand", cards => setMyHand(cards || []));
    newSocket.on("handPoints", points => setHandPoints(points));
    newSocket.on("gameStart", data => {
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
    newSocket.on("turnUpdate", data => {
      setStack(data.stack || []);
      setCurrentTurn(data.currentTurn);
      setUserTurns(data.userTurns || {});
      setScoresTable(data.scoresTable || []);
      setRoundNum(data.roundNum || 1);
      setPickPhase(false);
      setGamePointLimit(data.gamePointLimit || null);
      setReEntry(data.reEntry || {});
    });
    newSocket.on("stackUpdate", stack => setStack(stack || []));
    newSocket.on("lastPlayedBundle", bundle => setLastPlayedBundle(bundle || []));
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
    newSocket.on("declareResult", res => {
      setDeclareStatus(res ?? null);
      if (res && res.scoresTable) setScoresTable(res.scoresTable);
      if (res && res.reEntry) setReEntry(res.reEntry);
      if (res && res.roundNum) setRoundNum(res.roundNum);
      if (res && res.winner) setWinner(res.winner);
    });
    newSocket.on("limitProposal", (limit) => setProposedLimit(limit||""));
    newSocket.on("limitVoteUpdate", (votes) => setLimitVoters(votes||{}));
    newSocket.on("limitFinalized", limit => setGamePointLimit(limit));
    newSocket.on("gameWinner", win => setWinner(win));

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
        setSelectedCards(selectedCards.filter(i => i !== idx));
      } else {
        setSelectedCards([...selectedCards, idx]);
      }
    }
  }

  const allSameValue = selectedCards.length > 0 && selectedCards.every(idx => myHand[idx]?.value === myHand[selectedCards[0]]?.value && myHand[idx]?.value !== "JOKER");
  const validSequence = isSequence(selectedCards.map(idx=>myHand[idx]));
  const canPlaySelected =
    selectedCards.length === 1 ||
    (selectedCards.length >= 2 && allSameValue) ||
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
        cards: selectedCards.map(index => (myHand || [])[index])
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
  const thisPlayer = lobby.find(u => u.name === username);

  // Declare button should only show when all conditions are met
  const canDeclare =
    thisPlayer &&
    userTurns &&
    userTurns[thisPlayer.id] >= 2 &&
    handPoints <= 15 &&
    !declareStatus &&
    !pickPhase &&
    currentTurn === thisPlayer.id;

  function totalForPlayer(playerName) {
    return (scoresTable || []).reduce((sum, round) => sum + (round[playerName] || 0), 0);
  }
  const playerNames = (lobby || []).map(u=>u.name) || [];
  const reEntryPlayers = Object.entries(reEntry || {}).filter(([n,v])=>v>0).map(([n])=>n);

  return (
    <div style={{ padding: 40 }}>
      {gameState && (
        <div>
          <ScoresTable
            rounds={scoresTable}
            playerNames={playerNames}
            totalForPlayer={totalForPlayer}
          />
        </div>
      )}

      <h1>Multiplayer Card Game Lobby</h1>
      {gameState && (
      <><b>Round: {roundNum}</b><br/><b>Current turn:</b> {(lobby.find(l => l.id === currentTurn)?.name)||"?"}</>
      )}
      {!joined ? (
        <div>
          <input
            placeholder="Enter your name"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <button onClick={handleJoin}>Join Lobby</button>
        </div>
      ) : (
        <>
          <p>Lobby users:</p>
          <ul>
            {(lobby || []).map(user => (
              <li key={user?.id}>{user?.name}{reEntryPlayers.includes(user.name) && <span style={{color:'red',fontWeight:'bold'}}> (1 re-entry/life used)</span>}</li>
            ))}
          </ul>
          {!gameState && lobby.length >= 2 && (
            <button onClick={() => socket.emit("startGame")}>Start Game</button>
          )}
          {gameState ? (
            <div>
              <h2>Your Hand (select cards)</h2>
              <Hand hand={myHand} selectedCards={selectedCards} onCardClick={toggleSelectCard} />
              <h3>Your total points: {handPoints || calcPoints(myHand)}</h3>
              {currentTurn === socket?.id && !pickPhase && selectedCards.length > 0 && canPlaySelected &&
                <button onClick={playSelectedCards}>Play Selected Cards</button>
              }
              {canDeclare && (
                <button style={{ marginLeft: 20, background: "#28a745", color: "#fff" }} onClick={onDeclare}>
                  Declare
                </button>
              )}
              {gameState && !userTurns[currentTurn] && currentTurn === socket?.id && (
                <button onClick={firstPlayerPick}>Start your turn (draw from deck)</button>
              )}
              <Stack stack={stack} lastPlayedBundle={lastPlayedBundle} />
              {pickPhase && (
                <>
                  <h3>Pick a card</h3>
                  <button onClick={() => pickFrom("deck")}>Pick from Deck</button>
                  <span> Or pick from previous player's bundle:</span>
                  <Hand
                    hand={lastPlayedBundle || []}
                    selectedCards={[]}
                    onCardClick={(_idx) => pickFrom("bundle", _idx)}
                  />
                </>
              )}
              <p>
                {currentTurn === socket?.id
                  ? pickPhase
                    ? "Pick a card before next turn."
                    : "It's your turn! Select card(s) and play, or declare if eligible."
                  : "Waiting for other player..."}
              </p>
              {declareStatus && (
                <div>
                  <h2>Declare Result (Round {declareStatus.roundNum})</h2>
                  <ul>
                    {Object.entries(declareStatus.roundScore || {}).map(([name, points]) => (
                      <li key={name}>{name}: {points} points</li>
                    ))}
                  </ul>
                  {declareStatus.challenged ? (
                    <div style={{ color: "red" }}>Challenged! Someone has fewer points than the declarer.</div>
                  ) : (
                    <div style={{ color: "green" }}>Congratulations! No one beat your score.</div>
                  )}
                </div>
              )}
              {winner && <h2 style={{ color: "green" }}>🏆 GAME WINNER: {winner}</h2>}
            </div>
          ) : (
                        <p>Waiting for all players to join...</p>
          )}
        </>
      )}
    </div>
  );
}

export default App;

