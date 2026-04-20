import { motion } from 'motion/react';
import { getDisplayCard } from '../lib/gameLogic';

export default function Card({ card, hidden = false, className = '' }: { card?: string; hidden?: boolean; className?: string }) {
    if (hidden || !card) {
        // Render card back
        return (
            <motion.div 
                initial={{ scale: 0, rotateY: 90 }}
                animate={{ scale: 1, rotateY: 0 }}
                className={`w-[50px] h-[75px] sm:w-[65px] sm:h-[95px] bg-[repeating-linear-gradient(45deg,#451a03_0,#451a03_2px,#78350f_2px,#78350f_4px)] border-[3px] border-white rounded shadow-[0_4px_10px_rgba(0,0,0,0.5)] ${className}`}
            />
        );
    }

    const { rank, suit, color } = getDisplayCard(card);
    const suitColorClass = color === 'text-red-600' ? 'text-[#e11d48]' : 'text-[#1a1a1a]';

    return (
        <motion.div
            initial={{ scale: 0, rotateY: 90 }}
            animate={{ scale: 1, rotateY: 0 }}
            className={`w-[50px] h-[75px] sm:w-[65px] sm:h-[95px] bg-white rounded flex flex-col items-center justify-center relative shadow-[0_4px_10px_rgba(0,0,0,0.5)] border border-gray-200 ${className}`}
        >
            <span className={`absolute top-1 left-1.5 text-[14px] sm:text-[18px] font-black leading-none ${suitColorClass}`}>{rank}</span>
            <span className={`absolute top-5 left-1.5 text-[14px] sm:text-[18px] leading-none ${suitColorClass}`}>{suit}</span>
            <span className={`text-[24px] sm:text-[32px] ${suitColorClass}`}>{suit}</span>
            <span className={`absolute bottom-1 right-1.5 text-[14px] sm:text-[18px] font-black leading-none rotate-180 ${suitColorClass}`}>{rank}</span>
        </motion.div>
    );
}
