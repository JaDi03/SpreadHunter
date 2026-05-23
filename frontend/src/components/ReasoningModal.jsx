import React, { useEffect, useState } from 'react';

export default function ReasoningModal({ text }) {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    if (!text) return;
    
    setDisplayedText('');
    let i = 0;
    
    // Typewriter effect
    const interval = setInterval(() => {
      setDisplayedText((prev) => prev + text.charAt(i));
      i++;
      if (i >= text.length) clearInterval(interval);
    }, 20); // ms per char
    
    return () => clearInterval(interval);
  }, [text]);

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        SpreadHunter Agent :: AI Reasoning Trace
      </div>
      {text ? (
        <div className="typing-effect">
          {displayedText}
        </div>
      ) : (
        <div style={{ color: '#444' }}>
          &gt; Awaiting arbitrage opportunity analysis...
        </div>
      )}
    </div>
  );
}
