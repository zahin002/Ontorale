import React from 'react';
import type { Role } from '@ontorale/shared';
import {
  User,
  HeartPulse,
  BadgeAlert,
  Search,
  Crown,
  Skull,
  VolumeX,
  HelpCircle,
  Shield,
  Eye,
} from 'lucide-react';

export interface RoleArtDef {
  portraitUrl: string | null;
  color: string;
  bgColor: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const roleArt: Record<Role, RoleArtDef> = {
  citizen: {
    portraitUrl: null,
    color: 'text-slate-300',
    bgColor: 'bg-slate-700/60 border-slate-600',
    icon: User,
  },
  doctor: {
    portraitUrl: null,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-950/60 border-emerald-600/50',
    icon: HeartPulse,
  },
  police: {
    portraitUrl: null,
    color: 'text-blue-400',
    bgColor: 'bg-blue-950/60 border-blue-600/50',
    icon: BadgeAlert,
  },
  detective: {
    portraitUrl: null,
    color: 'text-amber-400',
    bgColor: 'bg-amber-950/60 border-amber-600/50',
    icon: Search,
  },
  mayor: {
    portraitUrl: null,
    color: 'text-purple-400',
    bgColor: 'bg-purple-950/60 border-purple-600/50',
    icon: Crown,
  },
  habildar: {
    portraitUrl: null,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-950/60 border-cyan-600/50',
    icon: Shield,
  },
  killer: {
    portraitUrl: null,
    color: 'text-rose-400',
    bgColor: 'bg-rose-950/60 border-rose-600/50',
    icon: Skull,
  },
  silencer: {
    portraitUrl: null,
    color: 'text-violet-400',
    bgColor: 'bg-violet-950/60 border-violet-600/50',
    icon: VolumeX,
  },
  confuser: {
    portraitUrl: null,
    color: 'text-orange-400',
    bgColor: 'bg-orange-950/60 border-orange-600/50',
    icon: HelpCircle,
  },
  stalker: {
    portraitUrl: null,
    color: 'text-pink-400',
    bgColor: 'bg-pink-950/60 border-pink-600/50',
    icon: Eye,
  },
};

interface RoleAvatarProps {
  role: Role;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const RoleAvatar: React.FC<RoleAvatarProps> = ({ role, size = 'md', className = '' }) => {
  const art = roleArt[role] || roleArt.citizen;
  const Icon = art.icon;

  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-8 h-8',
  }[size];

  if (art.portraitUrl) {
    return (
      <img
        src={art.portraitUrl}
        alt={role}
        className={`rounded-full object-cover ${sizeClasses} ${className}`}
      />
    );
  }

  return (
    <div
      className={`rounded-full p-1 border flex items-center justify-center shrink-0 ${art.bgColor} ${art.color} ${className}`}
    >
      <Icon className={sizeClasses} />
    </div>
  );
};

