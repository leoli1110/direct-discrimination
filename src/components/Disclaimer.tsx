import React from 'react';

export const Disclaimer: React.FC = () => {
  return (
    <div className="disclaimer" role="note">
      Engineering aid only. Curves are parametric reconstructions from published setting ranges and standard test points, not digitised manufacturer curves. Check against manufacturer software and selectivity tables before design or settings work.
    </div>
  );
};
