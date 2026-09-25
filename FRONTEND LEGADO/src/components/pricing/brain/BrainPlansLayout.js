import React from "react";

export default function BrainPlansLayout({ children, className = "" }) {
  return (
    <div className={`vb-brain-plans-shell${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}
