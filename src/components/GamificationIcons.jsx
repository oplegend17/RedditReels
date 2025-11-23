import { 
  Trophy, 
  Medal, 
  Target, 
  Flame, 
  Zap, 
  Clock, 
  RotateCcw, 
  Lock, 
  Crown, 
  Star, 
  Award, 
  Shield,
  Swords,
  Dumbbell,
  Timer,
  Infinity,
  Radiation,
  Share2
} from 'lucide-react';

export const GAMIFICATION_ICONS = {
  // Achievement Icons
  target: <Target className="w-full h-full" />,
  flame: <Flame className="w-full h-full" />,
  radiation: <Radiation className="w-full h-full" />,
  muscle: <Dumbbell className="w-full h-full" />,
  trophy: <Trophy className="w-full h-full" />,
  slots: <RotateCcw className="w-full h-full" />, // Using RotateCcw as a proxy for slots/spin
  zap: <Zap className="w-full h-full" />,
  timer: <Timer className="w-full h-full" />,
  runner: <Infinity className="w-full h-full" />, // Infinity for endurance/marathon
  crown: <Crown className="w-full h-full" />,
  lock: <Lock className="w-full h-full" />,
  hundred: <span className="font-black text-2xl">100</span>, // Custom text icon
  star: <Star className="w-full h-full" />,
  medal: <Medal className="w-full h-full" />,
  swords: <Swords className="w-full h-full" />,
  shield: <Shield className="w-full h-full" />,
  award: <Award className="w-full h-full" />,
  
  // Rank Icons
  rank1: <Trophy className="w-6 h-6 text-yellow-500" />,
  rank2: <Medal className="w-6 h-6 text-gray-300" />,
  rank3: <Medal className="w-6 h-6 text-amber-600" />,
  rankGeneric: <Award className="w-6 h-6 text-white/50" />,
  share: <Share2 className="w-6 h-6" />
};

export const getIcon = (name) => {
  return GAMIFICATION_ICONS[name] || <Star className="w-full h-full" />;
};
