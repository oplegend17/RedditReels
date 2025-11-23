import { useEffect, useState } from 'react';

export default function DrippingEffect({ onComplete }) {
  const [drops, setDrops] = useState([]);

  useEffect(() => {
    // Create random drops
    const newDrops = Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100, // Random horizontal position
      delay: Math.random() * 0.5, // Random start delay
      duration: 1.5 + Math.random() * 1, // Random duration
      width: 20 + Math.random() * 40, // Random width
    }));
    setDrops(newDrops);

    // Cleanup after animation
    const timer = setTimeout(() => {
      onComplete();
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden flex flex-col justify-start">
      {/* Main curtain of liquid */}
      <div className="w-full bg-white animate-drip-curtain absolute top-0 left-0 right-0 h-0" 
           style={{ animationDuration: '2.5s', animationFillMode: 'forwards' }} />
      
      {/* Individual drops */}
      {drops.map((drop) => (
        <div
          key={drop.id}
          className="absolute top-0 bg-white rounded-b-full animate-drip-drop"
          style={{
            left: `${drop.left}%`,
            width: `${drop.width}px`,
            height: '100px',
            animationDelay: `${drop.delay}s`,
            animationDuration: `${drop.duration}s`,
            opacity: 0.9,
          }}
        >
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[120%] h-[120%] bg-white rounded-full blur-sm" />
        </div>
      ))}
      
      <style jsx>{`
        @keyframes drip-curtain {
          0% { height: 0; opacity: 0.9; }
          40% { height: 100vh; opacity: 1; }
          80% { height: 100vh; opacity: 1; }
          100% { height: 100vh; opacity: 0; }
        }
        @keyframes drip-drop {
          0% { transform: translateY(-100%); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(120vh); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
