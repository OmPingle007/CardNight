import { useEffect, useState, useRef } from 'react';
import { auth, db, loginWithGoogle } from './firebase';
import { 
    doc, setDoc, onSnapshot, updateDoc, collection, getDocs, query, arrayUnion, serverTimestamp, getDoc 
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Room, Player, createDeck, shuffle, evaluateTeenPattiHand, evaluatePokerHand } from './lib/gameLogic';
import Card from './components/Card';
import confetti from 'canvas-confetti';
import { LogOut, Copy, Users, Play, AlertCircle, RefreshCw } from 'lucide-react';

// MAIN APP COMPONENT
export default function App() {
    const [user, setUser] = useState<User | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [room, setRoom] = useState<Room | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [roomId, setRoomId] = useState('');
    const [playerName, setPlayerName] = useState('');
    const [gameMode, setGameMode] = useState<'teen_patti' | 'poker'>('teen_patti');
    const [error, setError] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoadingAuth(false);
        });
        return () => unsubscribe();
    }, []);

    // Listen to room and players
    useEffect(() => {
        if (!roomId || !user) return;

        const unsubscribeRoom = onSnapshot(doc(db, 'rooms', roomId), (snapshot) => {
            if (snapshot.exists()) {
                setRoom({ id: snapshot.id, ...snapshot.data() } as Room);
            } else {
                setRoom(null);
            }
        });

        const unsubscribePlayers = onSnapshot(collection(db, 'rooms', roomId, 'players'), (snapshot) => {
            const p: Player[] = [];
            snapshot.forEach(d => p.push({ id: d.id, ...d.data() } as Player));
            setPlayers(p.sort((a,b) => a.seatIndex - b.seatIndex));
        });

        return () => {
            unsubscribeRoom();
            unsubscribePlayers();
        };
    }, [roomId, user]);

    const joinRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!user || !playerName || !roomId) return;
        const formattedRoomId = roomId.toUpperCase().trim();
        const roomRef = doc(db, 'rooms', formattedRoomId);
        
        try {
            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) {
                // Create room
                await setDoc(roomRef, {
                    hostId: user.uid,
                    status: 'waiting',
                    gameMode,
                    pot: 0,
                    currentBet: 0,
                    currentRound: 'waiting',
                    communityCards: [],
                    lastAction: 'Room created',
                    turnOrder: [],
                    turnIndex: 0,
                    updatedAt: Date.now() // Simple client-side timestamp to pass rules size 
                } as Room);
            } else {
                const r = roomSnap.data() as Room;
                if (r.status !== 'waiting') {
                    // It's ok to join if you were already in the room
                    const meSnap = await getDoc(doc(db, 'rooms', formattedRoomId, 'players', user.uid));
                    if (!meSnap.exists()) {
                        setError('Game already in progress.');
                        return;
                    }
                }
            }
            
            // Add Player
            const playerRef = doc(db, 'rooms', formattedRoomId, 'players', user.uid);
            const playerSnap = await getDoc(playerRef);
            let chips = 10000;
            if (playerSnap.exists()) {
               chips = playerSnap.data().chips;
            }

            // Figure out seat index
            const playersSnap = await getDocs(collection(db, 'rooms', formattedRoomId, 'players'));
            let seatIndex = playersSnap.size;
            if (playerSnap.exists()) {
               seatIndex = playerSnap.data().seatIndex;
            }

            await setDoc(playerRef, {
                name: playerName,
                chips: chips,
                status: 'waiting',
                currentBet: 0,
                cards: [],
                isBlind: true,
                seatIndex,
                updatedAt: Date.now()
            } as Player);

            setRoomId(formattedRoomId);
        } catch (err: any) {
            console.error(err);
            setError('Failed to join room: ' + err.message);
        }
    };

    if (loadingAuth) {
        return <div className="h-screen w-full flex items-center justify-center bg-zinc-900 text-white"><RefreshCw className="animate-spin" /></div>;
    }

    if (!user) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#050505] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1a2a1f] to-[#050505] text-[#f0f0f0] p-4 font-sans relative">
                <div className="bg-[rgba(10,10,10,0.8)] p-8 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-sm w-full border border-[#333] backdrop-blur-sm z-10 text-center">
                    <h1 className="text-3xl font-black mb-6 tracking-tight text-[#f0f0f0]">Card Night</h1>
                    <p className="text-white/60 mb-8 text-sm">Please sign in to continue</p>
                    {error && <div className="p-3 bg-red-900/50 text-red-200 text-sm rounded-lg mb-4 flex items-center justify-center gap-2"><AlertCircle className="w-4 h-4"/>{error}</div>}
                    <button 
                        onClick={() => {
                            setError('');
                            loginWithGoogle().catch((e: Error) => setError('Authentication failed: ' + e.message));
                        }}
                        className="w-full bg-[#15803d] hover:bg-green-700 text-white font-bold py-3 rounded-lg transition-colors shadow-[0_0_15px_rgba(21,128,61,0.5)] uppercase tracking-wider"
                    >
                        Sign in with Google
                    </button>
                </div>
            </div>
        );
    }

    if (!room) {
        // Lobby Screen
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#050505] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1a2a1f] to-[#050505] text-[#f0f0f0] p-4 font-sans relative">
                <form onSubmit={joinRoom} className="bg-[rgba(10,10,10,0.8)] p-8 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-sm w-full border border-[#333] backdrop-blur-sm z-10">
                    <h1 className="text-3xl font-black mb-6 text-center tracking-tight text-[#f0f0f0]">Card Night</h1>
                    {error && <div className="p-3 bg-red-900/50 text-red-200 text-sm rounded-lg mb-4 flex items-center gap-2"><AlertCircle className="w-4 h-4"/>{error}</div>}
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Nickname</label>
                            <input 
                                required
                                maxLength={15}
                                type="text"
                                className="w-full bg-black/60 border border-[#333] rounded-lg px-4 py-3 outline-none focus:border-[#15803d] focus:ring-1 focus:ring-[#15803d] transition-all font-medium text-white"
                                placeholder="Your name"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Room Code</label>
                            <input 
                                required
                                maxLength={6}
                                type="text"
                                className="w-full bg-black/60 border border-[#333] rounded-lg px-4 py-3 outline-none focus:border-[#15803d] focus:ring-1 focus:ring-[#15803d] transition-all uppercase font-mono tracking-widest text-[#eab308]"
                                placeholder="e.g. ABCD"
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Game Mode (if creating)</label>
                            <select 
                                className="w-full bg-black/60 border border-[#333] rounded-lg px-4 py-3 outline-none focus:border-[#15803d] text-sm font-medium text-white"
                                value={gameMode}
                                onChange={(e) => setGameMode(e.target.value as any)}
                            >
                                <option value="teen_patti">Teen Patti</option>
                                <option value="poker">Texas Hold'em Poker</option>
                            </select>
                        </div>
                        <button type="submit" className="w-full bg-[#15803d] hover:bg-green-700 text-white font-bold py-3 rounded-lg mt-4 transition-colors shadow-[0_0_15px_rgba(21,128,61,0.5)] uppercase tracking-wider">
                            Join / Create Room
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    const leaveRoom = () => {
        setRoomId('');
        setRoom(null);
    };

    if (room.status === 'waiting') {
        return <WaitingRoom room={room} players={players} user={user!} onLeave={leaveRoom} />;
    }

    return <GameTable room={room} players={players} user={user!} onLeave={leaveRoom} />;
}

function WaitingRoom({ room, players, user, onLeave }: { room: Room, players: Player[], user: User, onLeave: () => void }) {
    const isHost = room.hostId === user.uid;
    const [startError, setStartError] = useState('');

    const startGame = async () => {
        setStartError('');
        if (!isHost) return;
        if (players.length < 2) {
            setStartError('Need at least 2 unique players to start. Make sure players use different Google Accounts!');
            return;
        }
        
        try {
            let deck = shuffle(createDeck());
        const turnOrder = shuffle([...players].map(p => p.id!));
        
        // Deal cards and deduct boot amounts
        const bootAmount = room.gameMode === 'teen_patti' ? 100 : 50; // SB for poker
        const bbAmount = bootAmount * 2;
        let pot = 0;
        let currentBet = bootAmount; // For teen patti
        
        if (room.gameMode === 'poker') {
            currentBet = bbAmount;
            // Need to deduct SB from index 0, BB from index 1. For simplicity, just everyone pays ante for now? 
            // Wait, the prompt says "Small Blind = 50, Big Blind = 100".
        }
        
        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            const pRef = doc(db, 'rooms', room.id!, 'players', p.id!);
            const amountToPay = room.gameMode === 'teen_patti' ? bootAmount : 0;
            
            // Give cards
            const numCards = room.gameMode === 'teen_patti' ? 3 : 2;
            const myCards = deck.slice(0, numCards);
            deck = deck.slice(numCards);

            await updateDoc(pRef, {
                status: 'active',
                cards: myCards,
                chips: Math.max(0, p.chips - amountToPay),
                currentBet: amountToPay,
                isBlind: true,
                updatedAt: Date.now()
            });
            pot += amountToPay;
        }

        let firstTurnIndex = 0;

        if (room.gameMode === 'poker') {
             // Handle blinds
             const p0 = turnOrder[0];
             const p1 = turnOrder.length > 1 ? turnOrder[1] : turnOrder[0];
             const p0Ref = doc(db, 'rooms', room.id!, 'players', p0);
             const p1Ref = doc(db, 'rooms', room.id!, 'players', p1);
             // Assuming enough chips
             await updateDoc(p0Ref, { chips: Math.max(0, players.find(x=>x.id===p0)!.chips - bootAmount), currentBet: bootAmount });
             await updateDoc(p1Ref, { chips: Math.max(0, players.find(x=>x.id===p1)!.chips - bbAmount), currentBet: bbAmount });
             pot = bootAmount + bbAmount;
             firstTurnIndex = 2 % turnOrder.length; // Action starts after BB
        }

        await updateDoc(doc(db, 'rooms', room.id!), {
            status: 'playing',
            pot,
            currentBet,
            communityCards: [],
            deck,
            turnOrder,
            turnIndex: firstTurnIndex,
            currentRound: room.gameMode === 'teen_patti' ? 'teen_patti_round' : 'pre-flop',
            lastAction: 'Game started!',
            turnDeadline: Date.now() + 30000,
            winnerInfo: '',
            updatedAt: Date.now()
        });
        } catch (e: any) {
            console.error(e);
            setStartError("Failed to start game: " + e.message);
        }
    };

    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-[#050505] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1a2a1f] to-[#050505] text-[#f0f0f0] p-4 font-sans">
            <div className="absolute top-4 right-4 z-50">
                <button onClick={onLeave} className="flex items-center gap-2 px-4 py-2 bg-red-900/40 hover:bg-red-800 text-red-200 rounded-lg text-sm font-bold border border-red-900/50 transition-colors">
                    <LogOut className="w-4 h-4" /> Leave Room
                </button>
            </div>
            
            <div className="bg-black/60 p-8 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-md w-full backdrop-blur-md border border-[#333]">
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#333]">
                    <div>
                        <h2 className="text-xl font-bold text-teal-500">Room Code</h2>
                        <div className="text-4xl font-mono tracking-widest mt-1 flex items-center gap-3">
                            {room.id}
                            <button onClick={() => navigator.clipboard.writeText(room.id!)} className="text-white/50 hover:text-white transition-colors">
                                <Copy className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-white/50 uppercase font-bold tracking-wider mb-1">Mode</div>
                        <div className="bg-white/10 px-3 py-1 rounded-full text-sm font-semibold text-[#eab308]">{room.gameMode === 'teen_patti' ? 'Teen Patti' : 'Poker'}</div>
                    </div>
                </div>

                <div className="mb-8">
                    <h3 className="text-sm font-bold uppercase text-white/50 tracking-widest flex items-center gap-2 mb-4">
                        <Users className="w-4 h-4"/> Players ({players.length}/10)
                    </h3>
                    <div className="space-y-2">
                        {players.map(p => (
                            <div key={p.id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-[#333]">
                                <span className="font-semibold">{p.name} {p.id === user.uid && <span className="text-teal-400 text-sm ml-2">(You)</span>}</span>
                                <span className="text-[#eab308] font-mono text-sm">₹{p.chips.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {startError && <div className="p-3 bg-red-900/50 text-red-200 text-sm rounded-lg mb-4 flex items-center justify-center gap-2"><AlertCircle className="w-4 h-4"/>{startError}</div>}

                {isHost ? (
                    <button 
                        onClick={startGame}
                        disabled={players.length < 2}
                        className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl shadow-[0_0_20px_rgba(45,212,191,0.3)] flex items-center justify-center gap-2 text-lg transition-all"
                    >
                        <Play className="w-5 h-5 fill-current" /> START GAME
                    </button>
                ) : (
                    <div className="text-center p-4 bg-white/5 rounded-xl text-white/70 font-medium animate-pulse border border-white/5">
                        Waiting for host to start...
                    </div>
                )}
            </div>
        </div>
    );
}

function GameTable({ room, players, user, onLeave }: { room: Room, players: Player[], user: User, onLeave: () => void }) {
    const me = players.find(p => p.id === user.uid);
    const isMyTurn = room.status === 'playing' && room.turnOrder[room.turnIndex] === user.uid && me?.status === 'active';
    const isHost = room.hostId === user.uid;

    useEffect(() => {
        if (!isMyTurn) return;
        const interval = setInterval(() => {
            if (Date.now() > room.turnDeadline!) {
                // Auto fold
                handleAction('fold');
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [isMyTurn, room.turnDeadline]);

    // Host timeout enforcement
    useEffect(() => {
        if (!isHost || room.status !== 'playing') return;
        const interval = setInterval(() => {
            if (Date.now() > (room.turnDeadline! + 2000)) { // 2s grace
                const currentP = players.find(p => p.id === room.turnOrder[room.turnIndex]);
                if (currentP && ['active', 'all_in'].includes(currentP.status)) {
                    // Host forces fold on disconnected player
                    forceFold(currentP.id!);
                }
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [isHost, room, players]);

    const forceFold = async (playerId: string) => {
        const pRef = doc(db, 'rooms', room.id!, 'players', playerId);
        const rRef = doc(db, 'rooms', room.id!);
        await updateDoc(pRef, { status: 'folded', updatedAt: Date.now() });
        const nextT = await nextTurn();
        await updateDoc(rRef, { turnIndex: nextT, turnDeadline: Date.now() + 30000, lastAction: 'Player auto-folded (timeout/dc)', updatedAt: Date.now() });
    };

    // End round check
    useEffect(() => {
        if (!isHost || room.status !== 'playing') return;
        
        const activePlayers = players.filter(p => p.status === 'active' || p.status === 'all_in');
        
        if (activePlayers.length === 1) {
            // Everyone else folded
            endRound(activePlayers[0]);
        }
    }, [players, room.status, isHost]);

    const endRound = async (winner: Player, forceShow = false) => {
        const roomRef = doc(db, 'rooms', room.id!);
        let winInfo = `${winner.name} won ₹${room.pot}`;
        // Actually, evaluate hands here if it's a showdown, but for now we trust `winner` arg or evaluate
        await updateDoc(roomRef, {
            status: 'finished',
            winnerInfo: winInfo,
            lastAction: winInfo,
            updatedAt: Date.now()
        });

        const pRef = doc(db, 'rooms', room.id!, 'players', winner.id!);
        await updateDoc(pRef, { chips: winner.chips + room.pot, updatedAt: Date.now() });

        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    };

    const nextTurn = async () => {
        // Find next active player
        let nextIdx = (room.turnIndex + 1) % room.turnOrder.length;
        let p = players.find(x => x.id === room.turnOrder[nextIdx]);
        let safety = 0;
        while (p && p.status !== 'active' && safety < 10) {
            nextIdx = (nextIdx + 1) % room.turnOrder.length;
            p = players.find(x => x.id === room.turnOrder[nextIdx]);
            safety++;
        }
        
        return nextIdx;
    };

    const handleAction = async (action: 'fold' | 'call' | 'raise' | 'show', raiseAmt?: number) => {
        if (!me || !isMyTurn) return;

        const pRef = doc(db, 'rooms', room.id!, 'players', me.id!);
        const rRef = doc(db, 'rooms', room.id!);

        let potAdd = 0;
        let newChips = me.chips;
        let newPlayerBet = me.currentBet;
        let rCurrentBet = room.currentBet;
        let pStatus = me.status;
        let lastActionStr = '';

        if (action === 'fold') {
            pStatus = 'folded';
            lastActionStr = `${me.name} folded`;
        } 
        else if (action === 'call') {
            const amountToMatch = room.gameMode === 'teen_patti' && me.isBlind ? rCurrentBet / 2 : rCurrentBet;
            const diff = amountToMatch - me.currentBet;
            const pay = Math.min(newChips, diff > 0 ? diff : amountToMatch); // simplified
            newChips -= pay;
            potAdd += pay;
            newPlayerBet += pay;
            lastActionStr = `${me.name} called ₹${pay}`;
        }
        else if (action === 'raise') {
             const amt = raiseAmt || (room.currentBet * 2);
             const amountToMatch = room.gameMode === 'teen_patti' && me.isBlind ? amt / 2 : amt;
             const diff = amountToMatch - me.currentBet;
             const pay = Math.min(newChips, diff > 0 ? diff : amountToMatch);
             newChips -= pay;
             potAdd += pay;
             newPlayerBet += pay;
             rCurrentBet = amt;
             lastActionStr = `${me.name} raised to ₹${amt}`;
        }
        else if (action === 'show') {
             // For teen patti show
             const amountToMatch = room.gameMode === 'teen_patti' && me.isBlind ? rCurrentBet : rCurrentBet * 2;
             newChips -= amountToMatch;
             potAdd += amountToMatch;
             // Evaluate winners client side (only the player issuing show evaluates)
             // Simplified for single file constraints
             const others = players.filter(p => (p.status === 'active' || p.status === 'all_in') && p.id !== me.id);
             if (others.length === 1) {
                 const other = others[0];
                 const myEval = evaluateTeenPattiHand(me.cards);
                 const otherEval = evaluateTeenPattiHand(other.cards);
                 const iWon = myEval.score > otherEval.score;
                 
                 lastActionStr = `${me.name} showed. ${iWon ? 'Won!' : 'Lost.'} against ${other.name}`;
                 
                 if (iWon) {
                     endRound(me);
                     return; 
                 } else {
                     endRound(other);
                     return;
                 }
             }
        }

        if (newChips === 0 && action !== 'fold') pStatus = 'all_in';

        await updateDoc(pRef, {
            chips: newChips,
            currentBet: newPlayerBet,
            status: pStatus,
            updatedAt: Date.now()
        });

        const nextT = await nextTurn();

        await updateDoc(rRef, {
            pot: room.pot + potAdd,
            currentBet: rCurrentBet,
            turnIndex: nextT,
            turnDeadline: Date.now() + 30000,
            lastAction: lastActionStr,
            updatedAt: Date.now()
        });
    };

    const nextRound = async () => {
        // Reset room and active players
        const updates: any[] = [];
        const tOrder = shuffle([...room.turnOrder]);
        
        let deck = shuffle(createDeck());
        let currentBet = room.gameMode === 'teen_patti' ? 100 : 100; // SB=50
        let pot = 0;

        for (const p of Object.values(players)) {
            const pRef = doc(db, 'rooms', room.id!, 'players', p.id!);
            if (p.chips <= 0) {
                 updates.push(updateDoc(pRef, { status: 'broke', cards: [], currentBet: 0, updatedAt: Date.now() }));
                 continue;
            }
            const cost = room.gameMode === 'teen_patti' ? 100 : 0;
            const myCards = deck.slice(0, room.gameMode === 'teen_patti' ? 3 : 2);
            deck = deck.slice(room.gameMode === 'teen_patti' ? 3 : 2);
            pot += cost;

            updates.push(updateDoc(pRef, {
                status: 'active',
                cards: myCards,
                chips: p.chips - cost,
                currentBet: cost,
                isBlind: true,
                updatedAt: Date.now()
            }));
        }

        await Promise.all(updates);

        await updateDoc(doc(db, 'rooms', room.id!), {
            status: 'playing',
            pot,
            currentBet,
            communityCards: [],
            deck,
            turnOrder: tOrder,
            turnIndex: 0,
            currentRound: room.gameMode === 'teen_patti' ? 'teen_patti_round' : 'pre-flop',
            lastAction: 'Next round started',
            turnDeadline: Date.now() + 30000,
            winnerInfo: '',
            updatedAt: Date.now()
        });
    };

    // Calculate positions (Oval)
    const renderSeat = (p: Player, i: number) => {
        const isActiveTurn = room.status === 'playing' && room.turnOrder[room.turnIndex] === p.id;
        const isMe = p.id === user.uid;

        return (
            <div key={p.id} className={`relative text-center w-[120px] z-10 transition-transform ${isActiveTurn ? 'scale-110' : 'scale-100'}`}>
                {/* Avatar/Name Plate */}
                <div className={`w-16 h-16 mx-auto mb-2 bg-[#1a1a1a] border-[3px] ${isActiveTurn ? 'border-[#eab308] shadow-[0_0_15px_rgba(234,179,8,0.5)]' : 'border-[#333]'} rounded-full flex items-center justify-center transition-all ${p.status === 'folded' ? 'opacity-50' : 'opacity-100'}`}>
                    <div className="text-2xl">{isMe ? '👤' : '👤'}</div>
                </div>
                
                <div className={`text-[13px] font-semibold mb-[2px] ${isMe ? 'text-teal-400' : 'text-[#f0f0f0]'}`}>{p.name}</div>
                <div className="text-[#eab308] text-[11px] font-bold font-mono">₹ {p.chips.toLocaleString()}</div>
                
                {p.status !== 'active' && p.status !== 'waiting' && <div className="bg-white/10 px-3 py-1 rounded-full text-[11px] font-semibold mt-1 inline-block text-white/50">{p.status}</div>}
                {p.isBlind && room.gameMode === 'teen_patti' && p.status === 'active' && <div className="bg-white/10 px-3 py-1 rounded-full text-[11px] font-semibold mt-1 inline-block text-white/50">BLIND</div>}
                {!p.isBlind && room.gameMode === 'teen_patti' && p.status === 'active' && <div className="bg-white/10 px-3 py-1 rounded-full text-[11px] font-semibold mt-1 inline-block text-[#eab308]">SEEN</div>}
                
                {/* Cards */}
                <div className="absolute top-[40px] left-1/2 -translate-x-1/2 w-full flex justify-center gap-[2px] z-[-1]">
                    {p.cards && p.cards.length > 0 ? p.cards.map((c, idx) => (
                        <Card key={idx} card={c} hidden={!isMe && room.status === 'playing' && p.status !== 'folded'} />
                    )) : null}
                </div>
                
                {/* Bet amount */}
                {p.currentBet > 0 && <div className="absolute top-0 right-0 -mt-2 bg-zinc-800/80 text-yellow-300 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border border-yellow-500 hidden sm:block">₹{p.currentBet}</div>}
            </div>
        );
    };

    return (
        <div className="h-screen w-full flex flex-col bg-[#050505] text-[#f0f0f0] overflow-hidden font-sans">
            {/* Table Area */}
            <div className="flex-1 w-full flex flex-col items-center justify-center relative bg-[radial-gradient(circle_at_center,#1a2a1f_0%,#050505_100%)] p-4 sm:p-8">
                
                {/* HUD Top */}
                <div className="absolute top-5 left-5 right-5 flex justify-between z-20">
                     <div className="bg-white/5 py-2.5 px-3 sm:px-5 rounded-xl border border-white/10">
                         <div className="text-[10px] opacity-60 uppercase">Current Game</div>
                         <div className="text-[14px] sm:text-[18px] font-extrabold text-[#eab308]">{room.gameMode === 'teen_patti' ? 'Teen Patti' : "Texas Hold'em"}</div>
                     </div>
                     <div className="flex items-center gap-4">
                         <button onClick={onLeave} className="bg-red-900/40 hover:bg-red-800 text-red-200 py-2.5 px-4 rounded-xl border border-red-900/50 flex items-center gap-2 text-sm font-bold transition-colors">
                             <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Leave</span>
                         </button>
                         <div className="bg-white/5 py-2.5 px-3 sm:px-5 rounded-xl border border-white/10 text-right">
                             <div className="text-[10px] opacity-60 uppercase">Room Code</div>
                             <div className="text-[14px] sm:text-[18px] font-extrabold">{room.id}</div>
                         </div>
                     </div>
                </div>

                <div className="relative w-full max-w-[800px] h-[300px] sm:h-[400px] bg-[radial-gradient(ellipse_at_center,#1b4d32_0%,#0d2b1a_100%)] border-[8px] sm:border-[12px] border-[#3d2b1f] rounded-[150px] sm:rounded-[200px] shadow-[inset_0_0_50px_rgba(0,0,0,0.8),0_20px_40px_rgba(0,0,0,0.5)] flex items-center justify-center">
                    <div className="absolute inset-2 sm:inset-5 border border-white/5 rounded-[140px] sm:rounded-[180px] pointer-events-none z-0"></div>
                    
                    {/* Center Info (Pot, Community Cards, Last Action) */}
                    <div className="flex flex-col items-center z-10 text-center">
                        <div className="text-[#eab308] uppercase tracking-[0.2em] text-[10px] sm:text-[12px] font-bold mb-1">Current Pot</div>
                        <div className="text-[28px] sm:text-[42px] font-extrabold font-mono drop-shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                            ₹ {room.pot.toLocaleString()}
                        </div>

                        {room.communityCards && room.communityCards.length > 0 && (
                            <div className="flex justify-center gap-1 sm:gap-2 mt-3">
                                {room.communityCards.map((c, i) => <Card key={i} card={c} />)}
                            </div>
                        )}
                        
                        {room.status === 'finished' && (
                             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 rounded-[84px] sm:rounded-[184px] w-full h-full flex flex-col items-center justify-center z-50 p-4 sm:p-8 text-center backdrop-blur-sm">
                                 <h2 className="text-3xl sm:text-5xl font-black text-[#eab308] mb-2 sm:mb-4 drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]">WINNER</h2>
                                 <p className="text-lg sm:text-2xl font-bold text-white mb-6 sm:mb-8">{room.winnerInfo}</p>
                                 {isHost && (
                                     <button onClick={nextRound} className="bg-[#15803d] hover:bg-green-600 text-white px-6 py-3 sm:px-8 sm:py-4 rounded-xl font-black tracking-wider text-base sm:text-lg transition-transform active:scale-95">
                                         START NEXT ROUND
                                     </button>
                                 )}
                             </div>
                        )}
                    </div>

                    {isHost && room.gameMode === 'poker' && room.status === 'playing' && (
                        <div className="absolute top-4 left-4 flex gap-2 z-40">
                            {room.currentRound === 'pre-flop' && (
                                <button onClick={async () => {
                                    const c = room.deck!.slice(0, 3);
                                    await updateDoc(doc(db, 'rooms', room.id!), { communityCards: c, currentRound: 'flop', deck: room.deck!.slice(3), turnIndex: 0, updatedAt: Date.now() });
                                }} className="bg-blue-600 px-3 py-1 text-[10px] rounded font-bold uppercase cursor-pointer">Deal Flop</button>
                            )}
                            {room.currentRound === 'flop' && (
                                <button onClick={async () => {
                                    const c = [...room.communityCards, room.deck![0]];
                                    await updateDoc(doc(db, 'rooms', room.id!), { communityCards: c, currentRound: 'turn', deck: room.deck!.slice(1), turnIndex: 0, updatedAt: Date.now() });
                                }} className="bg-blue-600 px-3 py-1 text-[10px] rounded font-bold uppercase cursor-pointer">Deal Turn</button>
                            )}
                            {room.currentRound === 'turn' && (
                                <button onClick={async () => {
                                    const c = [...room.communityCards, room.deck![0]];
                                    await updateDoc(doc(db, 'rooms', room.id!), { communityCards: c, currentRound: 'river', deck: room.deck!.slice(1), turnIndex: 0, updatedAt: Date.now() });
                                }} className="bg-blue-600 px-3 py-1 text-[10px] rounded font-bold uppercase cursor-pointer">Deal River</button>
                            )}
                            {room.currentRound === 'river' && (
                                <button onClick={async () => {
                                    // Evaluate showdown
                                    const activeP = players.filter(p => p.status === 'active' || p.status === 'all_in');
                                    let bestScore = -1;
                                    let winner = activeP[0];
                                    for(const p of activeP){
                                        const h = evaluatePokerHand([...p.cards, ...room.communityCards]);
                                        if (h.rank > bestScore) { bestScore = h.rank; winner = p; }
                                    }
                                    endRound(winner, true);
                                }} className="bg-purple-600 px-3 py-1 text-[10px] rounded font-bold uppercase cursor-pointer">Showdown</button>
                            )}
                        </div>
                    )}

                    {/* Players positioned around table */}
                    {players.map((p, i) => {
                        // Oval positioning logic up to 10 players
                        let top, left, transform;
                        const total = Math.max(players.length, 2);
                        const angle = (i / total) * Math.PI * 2 - Math.PI / 2; // start top
                        
                        // Treat the table as a circle mapping to an oval (ellipse x and y adjustments depending on responsive aspect ratio, using percentages is best)
                        const rx = 52; // horizontal radius %
                        const ry = 62; // vertical radius %
                        
                        top = `${50 + Math.sin(angle) * ry}%`;
                        left = `${50 + Math.cos(angle) * rx}%`;
                        transform = `translate(-50%, -50%)`;

                        return (
                            <div key={p.id} className="absolute z-30" style={{ top, left, transform }}>
                                {renderSeat(p, i)}
                            </div>
                        );
                    })}
                </div>
                
                {room.lastAction && (
                    <div className="absolute bottom-5 sm:bottom-10 left-5 w-[200px] sm:w-[240px] bg-[rgba(0,0,0,0.5)] rounded-lg p-3 text-[12px] border border-white/10 z-20 hidden md:block">
                        <div className="opacity-50 mb-2 uppercase text-[10px]">Game Log</div>
                        <div className="text-[#4ade80]">{room.lastAction}</div>
                    </div>
                )}
            </div>

            {/* Controls Bar */}
            <div className="h-[100px] sm:h-[120px] bg-[rgba(10,10,10,0.95)] border-t border-[#333] flex items-center justify-between px-4 sm:px-10 z-20 pb-safe">
                <div className="flex items-center gap-5 hidden sm:flex">
                    {/* User Info */}
                    <div>
                        <div className="text-[10px] opacity-60 uppercase">Wallet</div>
                        <div className="text-[20px] font-extrabold text-[#eab308]">₹ {me?.chips.toLocaleString() || '0'}</div>
                    </div>
                    {me?.isBlind && room.gameMode === 'teen_patti' && (
                        <button 
                            onClick={() => updateDoc(doc(db, 'rooms', room.id!, 'players', me.id!), { isBlind: false })}
                            className="bg-[#1a1a1a] border border-[#333] hover:bg-[#333] px-3 py-1 rounded-full text-white text-[12px] font-bold transition-colors"
                        >
                            SEE CARDS
                        </button>
                    )}
                </div>

                {/* Actions */}
                <div className="flex-1 sm:flex-none flex justify-center gap-2 sm:gap-3 w-full">
                    <button 
                        disabled={!isMyTurn}
                        onClick={() => handleAction('fold')}
                        className="flex-1 sm:flex-none px-3 sm:px-7 py-3 rounded-lg font-bold uppercase transition-transform bg-[#b91c1c] text-white disabled:opacity-40"
                    >
                        Fold
                    </button>
                    <button 
                        disabled={!isMyTurn}
                        onClick={() => handleAction('call')}
                        className="flex-1 sm:flex-none px-3 sm:px-7 py-3 rounded-lg font-bold uppercase transition-transform bg-[#15803d] text-white disabled:opacity-40"
                    >
                        {room.gameMode === 'teen_patti' ? 'Chaal' : 'Call'}
                    </button>
                    <button 
                        disabled={!isMyTurn}
                        onClick={() => handleAction('raise')}
                        className="flex-1 sm:flex-none px-3 sm:px-7 py-3 rounded-lg font-bold uppercase transition-transform bg-[#eab308] text-black disabled:opacity-40"
                    >
                        Raise
                    </button>
                    {room.gameMode === 'teen_patti' && players.filter(p => p.status === 'active').length === 2 && (
                        <button 
                            disabled={!isMyTurn}
                            onClick={() => handleAction('show')}
                            className="flex-1 sm:flex-none px-3 sm:px-7 py-3 rounded-lg font-bold uppercase transition-transform bg-[#333] text-white disabled:opacity-40"
                        >
                            SHOW
                        </button>
                    )}
                </div>
                
                {me && me.chips === 0 && room.status === 'playing' && (
                    <button 
                        onClick={async () => {
                            await updateDoc(doc(db, 'rooms', room.id!, 'players', me.id!), { chips: 5000, status: 'waiting', updatedAt: Date.now() });
                        }}
                        className="bg-blue-600 text-white px-4 py-2 rounded font-bold uppercase animate-pulse absolute top-4 right-4 sm:static"
                    >
                        Rebuy ₹5000
                    </button>
                )}
            </div>
            {/* Mobile specific controls top row */}
            <div className="flex sm:hidden items-center justify-between bg-[rgba(10,10,10,0.95)] px-4 pb-2 pb-safe">
                 <div className="text-xs text-white/50 font-mono">Room: {room.id} | Wallet: <span className="text-[#eab308] font-bold">₹{me?.chips.toLocaleString()}</span></div>
                 {me?.isBlind && room.gameMode === 'teen_patti' && (
                        <button 
                            onClick={() => updateDoc(doc(db, 'rooms', room.id!, 'players', me.id!), { isBlind: false })}
                            className="bg-[#1a1a1a] border border-[#333] hover:bg-[#333] px-3 py-1 rounded-full text-white text-[10px] font-bold transition-colors"
                        >
                            SEE CARDS
                        </button>
                    )}
            </div>
        </div>
    );
}
