import { useEffect, useState } from 'react';

export default function IntensityMeter({ intensity, maxIntensity = 100, dangerZone = false, className = '' }) {
  const [pulse, setPulse] = useState(false);
  
  const percentage = (intensity / maxIntensity) * 100;
  
  // Trigger pulse effect in danger zone
  useEffect(() => {
    if (dangerZone) {
      const interval = setInterval(() => {
        setPulse(prev => !prev);
      }, 600);
      return () => clearInterval(interval);
    } else {
      setPulse(false);
    }
  }, [dangerZone]);

  // Get color based on intensity level
  const getColor = () => {
    if (percentage >= 85) return 'nuclear';
    if (percentage >= 70) return 'danger';
    if (percentage >= 50) return 'warning';
    return 'safe';
  };

  const color = getColor();

  return (
    <div className={`fixed top-28 right-6 z-50 ${className}`}>
      <div className="glass-panel p-4 rounded-2xl min-w-[200px] border-2 transition-all duration-300"
        style={{
          borderColor: dangerZone ? 'rgba(255, 47, 86, 0.8)' : 'rgba(255, 255, 255, 0.1)',
          boxShadow: dangerZone ? '0 0 30px rgba(255, 47, 86, 0.5)' : 'none'
        }}
      >
        {/* Label */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Intensity</span>
          <span className={`text-lg font-black transition-all duration-300 ${
            color === 'nuclear' ? 'text-red-500 animate-pulse' :
            color === 'danger' ? 'text-orange-500' :
            color === 'warning' ? 'text-yellow-500' :
            'text-green-500'
          }`}>
            {Math.round(percentage)}%
          </span>
        </div>

        {/* Meter Bar */}
        <div className="relative h-3 bg-black/50 rounded-full overflow-hidden border border-white/10">
          <div 
            className={`h-full transition-all duration-300 ease-out ${pulse ? 'animate-pulse' : ''}`}
            style={{
              width: `${percentage}%`,
              background: color === 'nuclear' ? 'linear-gradient(90deg, #ff0000, #ff8800)' :
                          color === 'danger' ? 'linear-gradient(90deg, #ff4400, #ffcc00)' :
                          color === 'warning' ? 'linear-gradient(90deg, #ffcc00, #00f3ff)' :
                          'linear-gradient(90deg, #00f3ff, #00ff88)',
              boxShadow: dangerZone ? '0 0 10px rgba(255, 47, 86, 0.8)' : 'none'
            }}
          />
        </div>

        {/* Status Text */}
        <div className="mt-2 text-center">
          {percentage >= 85 && (
            <div className="text-xs font-black text-red-500 animate-pulse flex items-center justify-center gap-1">
              <span>☢️</span>
              <span>CRITICAL</span>
              <span>☢️</span>
            </div>
          )}
          {percentage >= 70 && percentage < 85 && (
            <div className="text-xs font-bold text-orange-500 flex items-center justify-center gap-1">
              <span>🔥</span>
              <span>DANGER ZONE</span>
              <span>🔥</span>
            </div>
          )}
          {percentage >= 50 && percentage < 70 && (
            <div className="text-xs font-semibold text-yellow-500">
              ⚠️ Warning
            </div>
          )}
          {percentage < 50 && (
            <div className="text-xs font-medium text-green-500/70">
              Under Control
            </div>
          )}
        </div>
      </div>

      {/* Danger Screen Effect */}
      {dangerZone && (
        <div 
          className="fixed inset-0 pointer-events-none z-40 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at center, rgba(255,47,86,0.1) 0%, transparent 70%)`,
            animation: 'pulse-danger 1.5s ease-in-out infinite'
          }}
        />
      )}
    </div>
  );
}
