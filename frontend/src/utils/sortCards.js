// src/utils/sortCards.js
const valuesArr = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const pointsMap = {
  "A": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6,
  "7": 7, "8": 8, "9": 9, "10": 10, J: 10, Q: 10, K: 10, JOKER: 0
};
export default function sortCards(cards) {
  return [...cards].sort((a, b) => {
    const pa = pointsMap[a.value], pb = pointsMap[b.value];
    if (pa !== pb) return pa - pb;
    if (a.suit === b.suit) return valuesArr.indexOf(a.value) - valuesArr.indexOf(b.value);
    if (a.value === "JOKER") return 1;
    if (b.value === "JOKER") return -1;
    return (a.suit || '').localeCompare(b.suit || '');
  });
}
export { pointsMap, valuesArr };
