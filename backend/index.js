// Required modules
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

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
let gamePointLimit = null, proposedLimit = null, limitVoters = {};
let reEntry = {}, reEntryUsed = {};
let activePlayers = [];
let winner = null;

// --- Game helpers ---
function isSequence(cards) {
  if (cards.length < 3) return false;
  let noJokers = cards.filter(c => c.value !== "JOKER");
  let jokers = cards.length - noJokers.length;
  if (noJokers.length < 2) return false;
  let suit = noJokers[0].suit;
  if (!noJokers.every(card => card.suit === suit)) return false;
  const valuesArr = values;
  let nums = noJokers.map(c => valuesArr.indexOf(c.value)).sort((a,b)=>a-b);
  let min = nums[0], max = nums[nums.length-1];
  let needed = max - min + 1 - noJokers.length;
  return needed <= jokers;
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
function totalForPlayer(playerName) {
  return (scoresTable || []).reduce((sum, round) => sum + (round[playerName] || 0), 0);
}
function startNewRound() {
  roundNum += 1;
  roundStartIndex = (roundStartIndex + 1) % activePlayers.length;
  deck = buildDeck(); shuffle(deck); stack = [deck.pop()];
  playedBundles = [];
  dealCardsToUsers(); userTurns = {};
  currentTurnIndex = roundStartIndex;
  userTurns[activePlayers[roundStartIndex].id] = 1;
  for (const user of activePlayers) {
    io.to(user.id).emit("yourHand", hands[user.id]);
    io.to(user.id).emit("handPoints", hands[user.id].reduce((acc, c) => acc + cardPoints[c.value], 0));
  }
  io.emit("gameStart", {
    stack, currentTurn: activePlayers[roundStartIndex].id, roundNum,
    players: activePlayers.map(u => ({ id: u.id, name: u.name })), userTurns, scoresTable, gamePointLimit, reEntry
  });
}

// --- Event Handlers ---
io.on("connection", (socket) => {
  socket.on("joinLobby", (username) => {
    if (gameStarted) {socket.emit("gameFull","Game already started");return;}
    lobbyUsers.push({ id: socket.id, name: username });
    io.emit("lobbyUpdate", lobbyUsers);
  });

  socket.on("proposeLimit", (limit) => {
    gamePointLimit = limit;
    io.emit("limitFinalized", gamePointLimit);
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

  socket.on("firstTurnPick", () => {
    if (activePlayers.length===0||!gameStarted) return;
    let user = activePlayers[currentTurnIndex];
    if (!hands[user.id] || hands[user.id].length===0) return;
    if (deck.length>0) {
      let card = deck.pop();
      hands[user.id].push(card);
      io.to(user.id).emit("yourHand", hands[user.id]);
      io.to(user.id).emit("handPoints", hands[user.id].reduce((acc, c) => acc + cardPoints[c.value], 0));
    }
    nextTurn();
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
          playedBundles[i].bundle.filter(card=>!(card.value===picked.value&&card.suit===picked.suit));
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

  socket.on("declare", () => {
    const declarerId = socket.id;
    if (!userTurns[declarerId] || userTurns[declarerId]<2) {
      io.to(declarerId).emit("declareResult", { success:false, reason:"You must take at least 2 turns before declaring." });
      return;
    }
    const declarerPoints = hands[declarerId]?.reduce((acc,c)=>acc+cardPoints[c.value],0)||0;
    if (declarerPoints>=15) {
      io.to(declarerId).emit("declareResult", { success:false, reason:"You must have less than 15 points to declare." });
      return;
    }
    let handPoints = {};
    for (const user of activePlayers) {
      handPoints[user.name]=hands[user.id]?.reduce((acc,c)=>acc+cardPoints[c.value],0)||0;
    }
    let challenged = false;
    for (const user of activePlayers) {
      if (user.id!==declarerId && handPoints[user.name]<declarerPoints) challenged=true;
    }
    let roundScore = {};
    if (!challenged) {
      activePlayers.forEach(u=>{ roundScore[u.name] = (u.id===declarerId) ? -5 : handPoints[u.name]; });
    } else {
      activePlayers.forEach(u=>{
        if(u.id===declarerId) roundScore[u.name]=30;
        else if(handPoints[u.name]<declarerPoints) roundScore[u.name]=-3;
        else roundScore[u.name]=handPoints[u.name];
      });
    }
    scoresTable.push(roundScore);

    for (const user of activePlayers) {
      let total = totalForPlayer(user.name);
      if (gamePointLimit && total >= gamePointLimit) {
        if (!reEntry[user.name]) {
          let below = activePlayers.filter(u2=>totalForPlayer(u2.name)<gamePointLimit).map(u2=>totalForPlayer(u2.name));
          let re = below.length?Math.max(...below):0;
          scoresTable[scoresTable.length-1][user.name] -= (total - re);
          reEntry[user.name] = 1;
        } else {
          user.out = true;
        }
      }
    }
    activePlayers = activePlayers.filter(u => !u.out);

    io.emit("declareResult", {
      success:true, handPoints, declarer:activePlayers.find(u=>u.id===declarerId)?.name||null,
      challenged, roundScore, scoresTable, roundNum, reEntry, winner
    });
    setTimeout(()=>{ startNewRound(); },5000);
  });

  socket.on('disconnect', () => {
    lobbyUsers = lobbyUsers.filter(user=>user.id!==socket.id);
    io.emit("lobbyUpdate", lobbyUsers);
    if (gameStarted) {
      gameStarted=false;deck=[];hands={};stack=[];playedBundles=[]; io.emit("gameReset");
    }
  });
});

const PORT = process.env.PORT || 5050;
server.listen(PORT,()=>{console.log(`Server running on port ${PORT}`)});
