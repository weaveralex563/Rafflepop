import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { X } from "lucide-react";

interface WinPopupProps {
  isOpen: boolean;
  onClose: () => void;
  prizeAmount: number;
}

export default function WinPopup({ isOpen, onClose, prizeAmount }: WinPopupProps) {
  useEffect(() => {
    if (isOpen) {
      // Trigger confetti
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 200 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#8a33e0', '#f5bc0d', '#ffffff']
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#8a33e0', '#f5bc0d', '#ffffff']
        });
      }, 250);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-[340px] rounded-[28px] border border-secondary/30 bg-gradient-to-br from-[#1a0a3c] via-[#170d30] to-[#0f0920] p-8 text-center shadow-2xl shadow-secondary/20"
          >
            {/* Inner glow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden rounded-[28px]">
              <div className="w-[240px] h-[240px] bg-secondary/10 rounded-full blur-[50px]" />
            </div>

            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="text-[72px] leading-none mb-4"
            >
              🏆
            </motion.div>

            <h2 className="font-display text-2xl mb-2 text-white">You Won!</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Congratulations — you're today's lucky winner!
            </p>

            <div className="bg-secondary/10 border border-secondary/30 rounded-2xl p-5 mb-6">
              <div className="text-[10px] font-bold uppercase tracking-wider text-secondary mb-1">
                Prize Won
              </div>
              <div className="font-display text-4xl font-bold text-white">
                ₦{prizeAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>

            <button 
              onClick={onClose}
              className="w-full py-4 rounded-xl font-bold text-black bg-gradient-to-r from-secondary to-orange-400 hover:opacity-90 active:scale-95 transition-all shadow-[0_0_20px_rgba(245,188,13,0.3)]"
            >
              Claim Prize 🎉
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
