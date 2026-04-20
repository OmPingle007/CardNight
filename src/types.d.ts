declare module 'pokersolver' {
    export class Hand {
        static solve(cards: string[], game?: string, canTie?: boolean): any;
        static winners(hands: any[]): any[];
        name: string;
        rank: number;
        cards: any[];
    }
}
