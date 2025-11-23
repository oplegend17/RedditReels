import { useState, useEffect, useCallback, useRef } from 'react';

export const useIntensity = (isActive = false) => {
  const [intensity, setIntensity] = useState(0);
  const [dangerZone, setDangerZone] = useState(false);
  const lastUpdateRef = useRef(Date.now());
  const accumulationRef = useRef(null);

  // Intensity thresholds
  const DANGER_THRESHOLD = 70;
  const MAX_INTENSITY = 100;
  const DECAY_RATE = 0.5; // Per second when not active
  const BASE_ACCUMULATION = 0.3; // Per second base rate
  
  // Heat multipliers
  const HEAT_MULTIPLIERS = {
    nuclear: 3.0,
    fire: 2.0,
    spicy: 1.5,
    normal: 1.0
  };

  // Accumulate intensity based on video heat
  const accumulate = useCallback((heat = 'normal') => {
    const multiplier = HEAT_MULTIPLIERS[heat] || 1.0;
    const rate = BASE_ACCUMULATION * multiplier;
    
    setIntensity(prev => {
      const newIntensity = Math.min(prev + rate, MAX_INTENSITY);
      return newIntensity;
    });
  }, []);

  // Start accumulation loop
  const startAccumulation = useCallback((heat = 'normal') => {
    if (accumulationRef.current) return;
    
    accumulationRef.current = setInterval(() => {
      accumulate(heat);
    }, 1000); // Update every second
  }, [accumulate]);

  // Stop accumulation
  const stopAccumulation = useCallback(() => {
    if (accumulationRef.current) {
      clearInterval(accumulationRef.current);
      accumulationRef.current = null;
    }
  }, []);

  // Decay intensity when not watching
  useEffect(() => {
    if (!isActive) {
      const decayInterval = setInterval(() => {
        setIntensity(prev => Math.max(prev - DECAY_RATE, 0));
      }, 1000);
      
      return () => clearInterval(decayInterval);
    }
  }, [isActive]);

  // Update danger zone status
  useEffect(() => {
    setDangerZone(intensity >= DANGER_THRESHOLD);
  }, [intensity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAccumulation();
  }, [stopAccumulation]);

  const reset = useCallback(() => {
    setIntensity(0);
    setDangerZone(false);
    stopAccumulation();
  }, [stopAccumulation]);

  const boost = useCallback((amount) => {
    setIntensity(prev => Math.min(prev + amount, MAX_INTENSITY));
  }, []);

  return {
    intensity,
    dangerZone,
    maxIntensity: MAX_INTENSITY,
    startAccumulation,
    stopAccumulation,
    reset,
    boost,
    isWarning: intensity >= 50 && intensity < DANGER_THRESHOLD,
    isCritical: intensity >= 85
  };
};
