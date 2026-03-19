import { motion } from "framer-motion";

export default function LoadingScreen() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center min-h-[400px]">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-white/10" />
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary"
        />
        <div className="absolute inset-0 flex items-center justify-center text-2xl">
          🎱
        </div>
      </div>
      <p className="mt-4 text-muted-foreground font-medium text-sm animate-pulse">
        Loading RafflePop...
      </p>
    </div>
  );
}
