import React, { useEffect, useState } from 'react';

interface CountdownProps {
  phaseEndsAt: number | null;
  serverNow: number;
}

export const Countdown: React.FC<CountdownProps> = ({ phaseEndsAt, serverNow }) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (!phaseEndsAt) {
      setSecondsLeft(0);
      return;
    }

    const clientReceiptTime = Date.now();
    const serverClientOffset = serverNow - clientReceiptTime;

    const updateTimer = () => {
      const currentServerTime = Date.now() + serverClientOffset;
      const remainingMs = phaseEndsAt - currentServerTime;
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
      setSecondsLeft(remainingSec);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 200);
    return () => clearInterval(interval);
  }, [phaseEndsAt, serverNow]);

  if (!phaseEndsAt) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  return (
    <div
      data-testid="countdown"
      className="font-mono text-xl font-bold bg-slate-900 border border-slate-700 px-3 py-1 rounded-md text-rose-400"
    >
      {formatted}
    </div>
  );
};
