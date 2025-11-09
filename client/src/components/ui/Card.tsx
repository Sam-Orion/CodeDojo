import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  isHoverable?: boolean;
}

const Card = ({ children, className = '', isHoverable = false }: CardProps) => {
  return (
    <div
      className={`card p-6 ${
        isHoverable ? 'cursor-pointer transition-all hover:shadow-md hover:-translate-y-1' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export const CardHeader = ({ children, className = '' }: CardHeaderProps) => (
  <div className={`mb-4 border-b border-gray-200 pb-4 dark:border-gray-800 ${className}`}>
    {children}
  </div>
);

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export const CardBody = ({ children, className = '' }: CardBodyProps) => (
  <div className={`${className}`}>{children}</div>
);

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export const CardFooter = ({ children, className = '' }: CardFooterProps) => (
  <div className={`border-t border-gray-200 pt-4 dark:border-gray-800 ${className}`}>
    {children}
  </div>
);

export default Card;
