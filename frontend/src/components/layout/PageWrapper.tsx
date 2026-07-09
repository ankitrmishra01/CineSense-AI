import React from 'react';
import { motion } from 'framer-motion';

interface PageWrapperProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export const PageWrapper: React.FC<PageWrapperProps> = ({ children, style }) => (
  <motion.div
    variants={pageVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{ duration: 0.35, ease: 'easeOut' }}
    style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '40px 24px',
      ...style,
    }}
  >
    {children}
  </motion.div>
);
