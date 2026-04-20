import { Hand } from 'pokersolver';

export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']; // Changed '10' to 'T' for pokersolver

export function createDeck() {
  const deck: string[] = [];
  // For pokersolver, suits are lowercase letters: s, h, d, c
  const POKER_SUITS = ['s', 'h', 'd', 'c'];
  for (const suit of POKER_SUITS) {
    for (const rank of RANKS) {
      deck.push(`${rank}${suit}`);
    }
  }
  return deck;
}


export function shuffle<T>(array: T[]): T[] {
  const newArray = [...array];
  let currentIndex = newArray.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [newArray[currentIndex], newArray[randomIndex]] = [newArray[randomIndex], newArray[currentIndex]];
  }
  return newArray;
}

export function getDisplayCard(cardStr: string) {
    if (!cardStr) return { rank: '', suit: '', color: 'text-gray-900' };
    const rank = cardStr[0] === 'T' ? '10' : cardStr[0];
    const suitChar = cardStr[1];
    
    let suit = '';
    let color = 'text-gray-900';
    if (suitChar === 's') { suit = '♠'; color = 'text-gray-900'; }
    else if (suitChar === 'h') { suit = '♥'; color = 'text-red-600'; }
    else if (suitChar === 'd') { suit = '♦'; color = 'text-red-600'; }
    else if (suitChar === 'c') { suit = '♣'; color = 'text-gray-900'; }
    
    return { rank, suit, color };
}

export function evaluateTeenPattiHand(cards: string[]) {
    // Expects 3 cards
    if (cards.length !== 3) return { name: 'Invalid', rank: 0, score: 0 };
    
    const rankValues: Record<string, number> = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };

    const parsedCards = cards.map(c => ({ rankValue: rankValues[c[0]], suit: c[1] }))
                             .sort((a, b) => b.rankValue - a.rankValue); // Descending

    const isFlush = parsedCards[0].suit === parsedCards[1].suit && parsedCards[1].suit === parsedCards[2].suit;
    
    // Check for straight (sequence)
    let isStraight = false;
    if (parsedCards[0].rankValue - 1 === parsedCards[1].rankValue && parsedCards[1].rankValue - 1 === parsedCards[2].rankValue) {
        isStraight = true;
    } else if (parsedCards[0].rankValue === 14 && parsedCards[1].rankValue === 3 && parsedCards[2].rankValue === 2) {
        // A, 3, 2 is also a sequence, often A 2 3
        isStraight = true;
        // Fix ordering so A acts as 1
        parsedCards[0].rankValue = 1;
        parsedCards.sort((a, b) => b.rankValue - a.rankValue); // 3, 2, 1
    }

    const isThreeOfKind = parsedCards[0].rankValue === parsedCards[1].rankValue && parsedCards[1].rankValue === parsedCards[2].rankValue;
    const isPair = parsedCards[0].rankValue === parsedCards[1].rankValue || parsedCards[1].rankValue === parsedCards[2].rankValue;

    // Score based on categories: 
    // Trail: 6000000 + rank
    // Pure Seq: 5000000 + high card
    // Seq: 4000000 + high card
    // Color: 3000000 + high card +...
    // Pair: 2000000 + pair + kicker
    // High Card: 1000000 + high card ...

    let score = 0;
    let name = '';

    const hexScore = (r1: number, r2: number, r3: number) => {
        return (r1 << 8) + (r2 << 4) + r3;
    };

    if (isThreeOfKind) {
        name = 'Trail';
        score = 6000000 + parsedCards[0].rankValue;
    } else if (isStraight && isFlush) {
        name = 'Pure Sequence';
        score = 5000000 + parsedCards[0].rankValue;
    } else if (isStraight) {
        name = 'Sequence';
        score = 4000000 + parsedCards[0].rankValue;
    } else if (isFlush) {
        name = 'Color';
        score = 3000000 + hexScore(parsedCards[0].rankValue, parsedCards[1].rankValue, parsedCards[2].rankValue);
    } else if (isPair) {
        name = 'Pair';
        const pairRank = parsedCards[0].rankValue === parsedCards[1].rankValue ? parsedCards[0].rankValue : parsedCards[1].rankValue;
        const kickerRank = parsedCards[0].rankValue === parsedCards[1].rankValue ? parsedCards[2].rankValue : parsedCards[0].rankValue;
        score = 2000000 + (pairRank << 4) + kickerRank;
    } else {
        name = 'High Card';
        score = 1000000 + hexScore(parsedCards[0].rankValue, parsedCards[1].rankValue, parsedCards[2].rankValue);
    }

    return { name, score, parsedCards };
}

export function evaluatePokerHand(cards: string[]) {
    // pokersolver Hand.solve takes an array like ['As', 'Tc']
    return Hand.solve(cards);
}

// Types
export interface Room {
    id?: string;
    hostId: string;
    status: 'waiting' | 'playing' | 'finished';
    gameMode: 'teen_patti' | 'poker';
    pot: number;
    currentBet: number;
    currentRound: string;
    communityCards: string[];
    lastAction: string;
    turnOrder: string[];
    turnIndex: number;
    turnDeadline?: number;
    deck?: string[];
    winnerInfo?: string;
    updatedAt: number;
}

export interface Player {
    id?: string;
    name: string;
    chips: number;
    status: 'waiting' | 'active' | 'folded' | 'all_in' | 'broke';
    currentBet: number;
    cards: string[];
    isBlind: boolean;
    seatIndex: number;
    updatedAt: number;
}
