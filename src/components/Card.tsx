import { motion } from 'motion/react';
import { getDisplayCard } from '../lib/gameLogic';

export default function Card({ card, hidden = false, className = '' }: { card?: string; hidden?: boolean; className?: string }) {
    if (hidden || !card) {
        // Render card back
        return (
            <motion.div 
                initial={{ scale: 0, rotateY: 90 }}
                animate={{ scale: 1, rotateY: 0 }}
                className={`w-[35px] h-[50px] sm:w-[45px] sm:h-[65px] bg-[#8b0000] border-2 border-white rounded shadow-[0_2px_5px_rgba(0,0,0,0.3)] ${className}`}
            />
        );
    }

    const { rank, suit, color } = getDisplayCard(card);
    const suitColorClass = color === 'text-red-600' ? 'text-[#e11d48]' : 'text-[#1a1a1a]';

    return (
        <motion.div
            initial={{ scale: 0, rotateY: 90 }}
            animate={{ scale: 1, rotateY: 0 }}
            className={`w-[35px] h-[50px] sm:w-[45px] sm:h-[65px] bg-white rounded flex items-center justify-center relative shadow-[0_2px_5px_rgba(0,0,0,0.3)] ${className}`}
        >
            <span className={`absolute top-0.5 left-1 text-[12px] sm:text-[14px] font-black ${suitColorClass}`}>{rank}</span>
            <span className={`absolute bottom-0 right-1 text-[14px] sm:text-[16px] ${suitColorClass}`}>{suit}</span>
        </motion.div>
    );
}
