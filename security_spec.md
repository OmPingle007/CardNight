# Security Specification for Teen Patti & Poker

## 1. Data Invariants
- A Room must have a hostId matching an authenticated user.
- Only the host or active members of a Room can update its state (like pot, turn index).
- Players can only create/update their own player document within a room (auth.uid == playerId).
- Game fields like chips must be numbers, cards must be bounded arrays (max 52).

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Room Create**: Client not signed in creating a room.
2. **Room ID Poisoning**: Room creation with a 1MB string ID.
3. **Spoof Player Update**: Player A trying to update Player B's chips.
4. **Giant Array Attack**: Setting `deck` or `cards` to an array of 1,000,000 elements.
5. **Non-Numeric Chips**: Setting chips to a string to break clients.
6. **Room Hijack**: Changing the `hostId` of an existing room.
7. **Phantom Member Update**: A user updating the `pot` of a room they didn't join.
8. **Invalid Status Injection**: Setting room status to "hacked".
9. **Negative Pot**: Setting the room pot to a negative number.
10. **Type Mismatch**: Setting `pot` to a string instead of a number.
11. **Huge Last Action**: Setting `lastAction` to a 5MB string.
12. **Orphaned Player**: Creating a player without a parent room.

## 3. Test Runner Concept
`firestore.rules.test.ts` will load up these specific payloads. Since this is an AI Studio agent environment and our focus is on client delivery, we enforce standard rules to prevent DDoW and spoofing while allowing the client-side Firebase state model to function correctly.
