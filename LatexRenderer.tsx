import React from 'react';

// Renders **text** as bold and strips any orphan ** so they never show in UI
export const renderBoldFragments = (str: string, accentClass = 'text-[var(--theme-accent)] font-semibold'): React.ReactNode => {
  if (!str) return null;
  const parts = str.split(/(\*\*[^*]*\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} className={accentClass}>{p.slice(2, -2)}</strong>
          : p.replace(/\*\*/g, '')
      )}
    </>
  );
};

// Utility to render LaTeX formulas in text
// Supports both inline ($...$) and display ($$...$$) math

interface MathComponentProps {
  formula: string;
  display?: boolean;
}

const MathComponent: React.FC<MathComponentProps> = ({ formula, display = false }) => {
  // Use KaTeX if available
  if (typeof window !== 'undefined' && (window as any).katex) {
    try {
      const katex = (window as any).katex;
      const html = katex.renderToString(formula, {
        throwOnError: false,
        displayMode: display,
        output: 'html',
        strict: false
      });
      return (
        <span 
          dangerouslySetInnerHTML={{ __html: html }}
          className={display ? 'block my-3 text-center' : 'inline'}
          style={{ 
            fontSize: display ? '18px' : 'inherit',
            lineHeight: display ? '1.8' : 'inherit'
          }}
        />
      );
    } catch (e) {
      console.warn('KaTeX rendering error:', e);
    }
  }

  // Fallback: render as styled code
  return (
    <span 
      className={`${display ? 'block my-2 text-center' : 'inline'} font-mono text-[var(--theme-accent)] bg-[var(--bg-card)] px-1.5 py-0.5 rounded`}
      style={{ fontSize: display ? '16px' : '14px' }}
    >
      {formula}
    </span>
  );
};

export const renderTextWithMath = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  // Match display math blocks ($$...$$) first - non-greedy to avoid conflicts
  const displayMathRegex = /\$\$([^$]+?)\$\$/g;
  let match;
  const displayMatches: Array<{ start: number; end: number; formula: string }> = [];
  
  while ((match = displayMathRegex.exec(text)) !== null) {
    displayMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      formula: match[1].trim()
    });
  }
  
  // Match inline math ($...$) but exclude those inside display blocks
  const inlineMathRegex = /\$([^$\n]+?)\$/g;
  const inlineMatches: Array<{ start: number; end: number; formula: string; isDisplay: boolean }> = [];
  
  while ((match = inlineMathRegex.exec(text)) !== null) {
    const isInsideDisplay = displayMatches.some(dm => 
      match!.index >= dm.start && match!.index < dm.end
    );
    if (!isInsideDisplay) {
      inlineMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        formula: match[1].trim(),
        isDisplay: false
      });
    }
  }
  
  // Combine and sort all matches
  const allMatches = [
    ...displayMatches.map(m => ({ ...m, isDisplay: true })),
    ...inlineMatches
  ].sort((a, b) => a.start - b.start);
  
  // Build React nodes (text segments get ** rendered as bold, no raw asterisks)
  allMatches.forEach((mathMatch, idx) => {
    if (mathMatch.start > lastIndex) {
      const beforeText = text.substring(lastIndex, mathMatch.start);
      if (beforeText) {
        parts.push(<React.Fragment key={`text-${idx}`}>{renderBoldFragments(beforeText)}</React.Fragment>);
      }
    }
    parts.push(
      <MathComponent key={`math-${idx}`} formula={mathMatch.formula} display={mathMatch.isDisplay} />
    );
    lastIndex = mathMatch.end;
  });

  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      parts.push(<React.Fragment key="text-final">{renderBoldFragments(remainingText)}</React.Fragment>);
    }
  }

  return parts.length > 0 ? parts : [<React.Fragment key="empty">{renderBoldFragments(text)}</React.Fragment>];
};
