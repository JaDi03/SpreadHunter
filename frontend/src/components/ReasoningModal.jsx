import React, { useEffect, useRef, useState } from 'react';

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function renderWithLinks(text) {
  return text.split(URL_REGEX).map((part, i) => {
    if (part.match(URL_REGEX)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          style={{ color: '#60A5FA', textDecoration: 'underline', wordBreak: 'break-all' }}>
          {part}
        </a>
      );
    }
    return part;
  });
}

export default function ReasoningModal({ text }) {
  const scrollRef  = useRef(null);
  const timerRef   = useRef(null);
  const fullTextRef = useRef('');
  const iRef       = useRef(0);
  const [displayed, setDisplayed] = useState('');

  // Typewriter effect — fires whenever `text` changes
  useEffect(() => {
    if (!text) {
      setDisplayed('');
      fullTextRef.current = '';
      iRef.current = 0;
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // Check if it's an append (the new text starts with the old target text)
    // This allows us to add "⚡ Executing..." without restarting the typing!
    const isAppend = fullTextRef.current && text.startsWith(fullTextRef.current);
    
    fullTextRef.current = text;

    if (!isAppend) {
      // It's a completely new reasoning block (new opportunity)
      setDisplayed('');
      iRef.current = 0;
    }

    // Clear any existing timer to avoid overlapping
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      iRef.current += 3; // type 3 chars at a time to keep up with the backend speed
      
      if (iRef.current >= fullTextRef.current.length) {
        setDisplayed(fullTextRef.current);
        clearInterval(timerRef.current);
      } else {
        setDisplayed(fullTextRef.current.slice(0, iRef.current));
      }
    }, 10); // ~300 chars per second

    return () => clearInterval(timerRef.current);
  }, [text]);

  // Auto-scroll as text grows
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayed]);

  return (
    <div className="terminal-panel" style={{ display: 'flex', flexDirection: 'column', height: '500px', maxWidth: '100%', overflow: 'hidden' }}>
      <div className="terminal-header" style={{ flexShrink: 0 }}>
        SpreadHunter Agent :: AI Reasoning Trace
      </div>

      {displayed ? (
        <div
          ref={scrollRef}
          style={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingRight: '10px' }}
        >
          {renderWithLinks(displayed)}
          {/* Blinking cursor while typing */}
          {displayed.length < (text?.length ?? 0) && (
            <span style={{ display: 'inline-block', width: '8px', height: '1em', background: 'var(--accent-green)', marginLeft: '2px', animation: 'blink 0.7s step-end infinite', verticalAlign: 'text-bottom' }} />
          )}
        </div>
      ) : (
        <div style={{ color: '#444', flexGrow: 1 }}>
          &gt; Awaiting arbitrage opportunity analysis...
        </div>
      )}
    </div>
  );
}
