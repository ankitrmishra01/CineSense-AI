import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  color?: 'purple' | 'gold' | 'green' | 'red';
}

const colorMap = {
  purple: {},
  gold: {
    background: 'rgba(245, 158, 11, 0.15)',
    color: '#f59e0b',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  green: {
    background: 'rgba(34, 197, 94, 0.15)',
    color: '#22c55e',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  red: {
    background: 'rgba(239, 68, 68, 0.15)',
    color: '#ef4444',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
};

export const Badge: React.FC<BadgeProps> = ({ children, color = 'purple' }) => (
  <span className="badge" style={color !== 'purple' ? colorMap[color] : {}}>
    {children}
  </span>
);
