import React, { useEffect, useRef } from 'react';

function formatTextWithLinks(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#60A5FA', textDecoration: 'underline', wordBreak: 'break-all' }}>
          {part}
        </a>
      );
    }
    return part;
  });
}

export default function ReasoningModal({ text }) {
  const scrollRef = useRef(null);
  
  // Auto-scroll to bottom when text changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [text]);

  return (
    <div className="terminal-panel" style={{ display: 'flex', flexDirection: 'column', height: '500px', maxWidth: '100%', overflow: 'hidden' }}>
      <div className="terminal-header" style={{ flexShrink: 0 }}>
        SpreadHunter Agent :: AI Reasoning Trace
      </div>
      {text ? (
        <div 
          className="typing-effect" 
          ref={scrollRef}
          style={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingRight: '10px' }}
        >
          {formatTextWithLinks(text)}
        </div>
      ) : (
        <div style={{ color: '#444', flexGrow: 1 }}>
          &gt; Awaiting arbitrage opportunity analysis...
        </div>
      )}
    </div>
  );
}
