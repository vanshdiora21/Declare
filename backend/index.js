const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const suits = ["♠", "♥", "♦", "♣"];
const values = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const cardPoints = { "A":1, "2":2, "3":3, "4":4, "5":5, "6":6, "7":7, "8":8, "9":9, "10":10, "J":10, "Q":10, "K":10, "JOKER":0 };

function buildDeck() {
  let deck = [];
  for (let k = 0; k < 2; k++) {
    for (let suit of suits) for (let value of values) deck.push({ value, suit });
    for (let j = 0; j < 3; j++) deck.push({ value: "JOKER", suit: "★" });
  }
  return deck;
}
function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1)); [deck[i], deck[j]]=[deck[j],deck[i]];
  }
}
let lobbyUsers = [];
let deck = [], hands = {}, stack = [], gameStarted = false, currentTurnIndex = 0, roundStartIndex = 0;
let playedBundles = [], userTurns = {}, scoresTable = [], roundNum = 1;
let gamePointLimit = null, reEntry = {}, activePlayers = [], winner = null;

function isSequence(cards) {
  if (cards.length < 3) return false;
  let jokers = cards.filter(card => card.value === "JOKER");
  let noJokers = cards.filter(card => card.value !== "JOKER");
  if (noJokers.length < 2) return false;
  let suit = noJokers[0].suit;
  if (!noJokers.every(card => card.suit === suit)) return false;
  let nums = noJokers.map(c => values.indexOf(c.value)).sort((a, b) => a - b);
  let min = nums[0], max = nums[nums.length - 1];
  let needed = max - min + 1 - noJokers.length;
  return needed <= jokers.length;
}
function bundlesAreCompatible(prev, cur) {
  if (!prev.length || !cur.length) return false;
  let prevVals = new Set(prev.map(card=>card.value).filter(v=>v!=="JOKER"));
  let curVals = new Set(cur.map(card=>card.value).filter(v=>v!=="JOKER"));
  for (let v of prevVals) if (curVals.has(v)) return true;
  let noJokerPrev = prev.filter(card=>card.value!=="JOKER");
  let noJokerCur = cur.filter(card=>card.value!=="JOKER");
  if (!noJokerPrev.length||!noJokerCur.length) return false;
  if (noJokerPrev[0].suit!==noJokerCur[0].suit) return false;
  let combined = [...prev,...cur];
  return isSequence(combined);
}
function dealCardsToUsers() {
  hands = {};
  for (const user of activePlayers) {
    hands[user.id] = [];
    let dealt = 0;
    while (dealt < 7 && deck.length > 0) { hands[user.id].push(deck.pop()); dealt++; }
  }
}
function nextTurn() {
  if (activePlayers.length === 1) {
    winner = activePlayers[0].name;
    io.emit("gameWinner", winner);
    gameStarted = false;
    return;
  }
  do {
    currentTurnIndex = (currentTurnIndex + 1) % activePlayers.length;
  } while ((activePlayers[currentTurnIndex]?.out || false) && activePlayers.length > 1);
  const curId = activePlayers[currentTurnIndex].id;
  userTurns[curId] = (userTurns[curId] || 0) + 1;
  io.emit("turnUpdate", {
    currentTurn: curId, stack, roundNum,
    players: activePlayers.map(u => ({ id: u.id, name: u.name })), userTurns, scoresTable, gamePointLimit, reEntry
  });
}
function getPrevBundle() {
  if (playedBundles.length === 0) return [];
  const curId = activePlayers[currentTurnIndex].id;
  for (let i = playedBundles.length - 1; i >= 0; i--) {
    if (playedBundles[i].playerId !== curId) return playedBundles[i].bundle || [];
  }
  return [];
}
io.on("connection", (socket) => {
  socket.on("joinLobby", (username) => {
    if (gameStarted) {socket.emit("gameFull","Game already started");return;}
    lobbyUsers.push({ id: socket.id, name: username });
    io.emit("lobbyUpdate", lobbyUsers);
  });
  socket.on("startGame", () => {
    if (gameStarted) return;
    if (lobbyUsers.length >= 2) {
      deck = buildDeck(); shuffle(deck);
      stack = [deck.pop()];
      playedBundles = [];
      activePlayers = lobbyUsers.map(u=>({...u,out:false}));
      reEntry = {}; winner = null;
      dealCardsToUsers(); gameStarted = true; roundNum = 1;
      roundStartIndex = 0; currentTurnIndex = 0; userTurns = {}; scoresTable = [];
      userTurns[activePlayers[0].id]=1;
      for (const user of activePlayers) {
        io.to(user.id).emit("yourHand", hands[user.id]);
        io.to(user.id).emit("handPoints", hands[user.id].reduce((acc, c) => acc + cardPoints[c.value], 0));
      }
      io.emit("gameStart", {
        stack, currentTurn: activePlayers[0].id, roundNum,
        players: activePlayers.map(u => ({ id: u.id, name: u.name })), userTurns, scoresTable, gamePointLimit, reEntry
      });
    }
  });
  socket.on("playCards", ({ cards }) => {
    const userId = socket.id;
    if (activePlayers[currentTurnIndex].id !== userId) return;
    // Cards exist in your hand?
    if (!cards || !Array.isArray(cards) || cards.length === 0 ||
      !cards.every(card => hands[userId]?.some(hc => hc.value === card.value && hc.suit === card.suit))) return;

    // Multi-card: same-value or valid sequence/run
    let allSameValue = false, isValidSeq = isSequence(cards);
    if (cards.length >= 2 && cards.every(card => card.value === cards[0].value)) allSameValue = true;
    if (!(cards.length === 1 || allSameValue || isValidSeq)) return;

    for (const card of cards) {
      hands[userId] = hands[userId].filter(c => !(c.value === card.value && c.suit === card.suit));
      stack.push(card); // append!
    }
    playedBundles.push({
      playerId: userId,
      bundle: [...cards],
      value: allSameValue ? cards[0].value : null,
      suit: isValidSeq ? (cards.find(c=>c.value!=="JOKER")||{}).suit : null
    });
    for (const user of activePlayers) {
      io.to(user.id).emit("yourHand", hands[user.id] || []);
      io.to(user.id).emit("handPoints", hands[user.id] ? hands[user.id].reduce((acc, c) => acc + cardPoints[c.value], 0) : 0);
    }
    io.emit("stackUpdate", stack || []);
    io.emit("lastPlayedBundle", getPrevBundle());
    let prev = playedBundles.length >= 2 ? playedBundles[playedBundles.length-2].bundle : null;
    let skipPick = false;
    if (prev && bundlesAreCompatible(prev, cards)) skipPick = true;
    if (skipPick) { nextTurn(); }
    else { socket.emit("yourPickPhase", { stack: stack||[], deckCount: deck.length, lastPlayedBundle: getPrevBundle() }); }
  });
  socket.on("pickCard", ({ source, cardIdx }) => {
    const userId = socket.id;
    if (activePlayers[currentTurnIndex].id !== userId) return;
    let picked = null;
    let prevBundle = getPrevBundle();
    if (source==="deck" && deck.length>0) {
      picked = deck.pop();
    } else if (source==="bundle" && prevBundle.length>0 && typeof cardIdx==="number" && prevBundle[cardIdx]) {
      picked = prevBundle.splice(cardIdx,1)[0];
      for (let i=playedBundles.length-1;i>=0;i--) {
        if (playedBundles[i].playerId!==userId &&
          playedBundles[i].bundle.some(card=>card.value===picked.value&&card.suit===picked.suit)) {
          playedBundles[i].bundle =
          playedBundles[i].bundle.filter(card=>!(card.value===picked.value&&card.suit===card.suit));
          break;
        }
      }
    }
    if (picked) {
      hands[userId].push(picked);
      io.to(userId).emit("yourHand", hands[userId]||[]);
      io.to(userId).emit("handPoints", hands[userId]?hands[userId].reduce((acc,c)=>acc+cardPoints[c.value],0):0);
      io.emit("lastPlayedBundle", getPrevBundle());
    }
    nextTurn();
  });
  // Other handlers: declare, etc, can be added as needed.
});
server.listen(5050,()=>{console.log("Backend on 5050")});
