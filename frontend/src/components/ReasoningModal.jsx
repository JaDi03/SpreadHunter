import React, { useEffect, useState, useRef } from 'react';

function formatTextWithLinks(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#60A5FA', textDecoration: 'underline' }}>
          {part}
        </a>
      );
    }
    return part;
  });
}

export default function ReasoningModal({ text }) {
  const [displayedText, setDisplayedText] = useState('');
  const scrollRef = useRef(null);
  
  useEffect(() => {
    if (!text) return;
    
    setDisplayedText('');
    let i = 0;
    
    // Typewriter effect
    const interval = setInterval(() => {
      setDisplayedText((prev) => prev + text.charAt(i));
      i++;
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      if (i >= text.length) clearInterval(interval);
    }, 10); // ms per char (faster for better UX)
    
    return () => clearInterval(interval);
  }, [text]);

  return (
    <div className="terminal-panel" style={{ display: 'flex', flexDirection: 'column', height: '300px' }}>
      <div className="terminal-header" style={{ flexShrink: 0 }}>
        SpreadHunter Agent :: AI Reasoning Trace
      </div>
      {text ? (
        <div 
          className="typing-effect" 
          ref={scrollRef}
          style={{ flexGrow: 1, overflowY: 'auto', whiteSpace: 'pre-wrap', paddingRight: '10px' }}
        >
          {formatTextWithLinks(displayedText)}
        </div>
      ) : (
        <div style={{ color: '#444', flexGrow: 1 }}>
          &gt; Awaiting arbitrage opportunity analysis...
        </div>
      )}
    </div>
  );
}
