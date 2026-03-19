import { useState, useEffect } from 'react';

interface CountdownTime {
  hours: string;
  minutes: string;
  seconds: string;
  isSoon: boolean;
}

export function useCountdown(): CountdownTime {
  const [timeLeft, setTimeLeft] = useState<CountdownTime>({
    hours: '00',
    minutes: '00',
    seconds: '00',
    isSoon: false,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      // Current time in UTC
      const utcNow = now.getTime() + (now.getTimezoneOffset() * 60000);
      // WAT is UTC+1
      const watNow = new Date(utcNow + 3600000);
      
      const watMidnight = new Date(watNow);
      watMidnight.setHours(24, 0, 0, 0);

      const difference = watMidnight.getTime() - watNow.getTime();

      if (difference > 0) {
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);

        setTimeLeft({
          hours: hours.toString().padStart(2, '0'),
          minutes: minutes.toString().padStart(2, '0'),
          seconds: seconds.toString().padStart(2, '0'),
          isSoon: hours < 1, // Show "Soon!" badge if less than 1 hour
        });
      } else {
        setTimeLeft({ hours: '00', minutes: '00', seconds: '00', isSoon: true });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  return timeLeft;
}
