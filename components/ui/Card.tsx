import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-md overflow-hidden border border-gray-300 ${className}`}
    >
      {children}
    </div>
  );
};

export default Card;