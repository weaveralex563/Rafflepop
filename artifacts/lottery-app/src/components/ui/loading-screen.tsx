import { motion } from "framer-motion";

export function LoadingScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh]">
      <motion.div
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.5, 1, 0.5]
        }}
        transition={{ 
          duration: 1.5, 
          repeat: Infinity,
          ease: "easeInOut" 
        }}
        className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"
      />
      <p className="mt-4 text-sm text-muted-foreground font-medium animate-pulse">Loading AdJackpot...</p>
    </div>
  );
}
