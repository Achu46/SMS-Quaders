import React from 'react';

/**
 * Lightweight, robust Markdown Renderer for AI responses
 * Handles Markdown tables, bold, italics, headers, lists, code blocks, and pills without external bulky dependencies.
 */
export default function MarkdownRenderer({ content }) {
  if (!content) return null;

  const renderFormattedLine = (line) => {
    // Process bold (**text**), inline code (`code`), and italics (*text*)
    const parts = [];
    let remaining = line;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // Bold **text**
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // Code `code`
      const codeMatch = remaining.match(/`([^`]+)`/);
      
      let firstMatch = null;
      let matchType = null;
      let matchIndex = remaining.length;

      if (boldMatch && boldMatch.index < matchIndex) {
        firstMatch = boldMatch;
        matchType = 'bold';
        matchIndex = boldMatch.index;
      }
      if (codeMatch && codeMatch.index < matchIndex) {
        firstMatch = codeMatch;
        matchType = 'code';
        matchIndex = codeMatch.index;
      }

      if (!firstMatch) {
        parts.push(<span key={keyIdx++}>{remaining}</span>);
        break;
      }

      if (matchIndex > 0) {
        parts.push(<span key={keyIdx++}>{remaining.substring(0, matchIndex)}</span>);
      }

      if (matchType === 'bold') {
        parts.push(
          <strong key={keyIdx++} className="font-semibold text-slate-900 dark:text-white">
            {firstMatch[1]}
          </strong>
        );
      } else if (matchType === 'code') {
        parts.push(
          <code key={keyIdx++} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-orange-600 dark:text-orange-400 font-mono text-xs border border-slate-200 dark:border-slate-700">
            {firstMatch[1]}
          </code>
        );
      }

      remaining = remaining.substring(matchIndex + firstMatch[0].length);
    }

    return parts;
  };

  const lines = content.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Table Detection (| Header 1 | Header 2 |)
    if (line.trim().startsWith('|') && line.includes('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
      const tableRows = [];
      const headerLine = line;
      const headers = headerLine.split('|').map(s => s.trim()).filter(Boolean);
      i += 2; // Skip header and separator

      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const rowCells = lines[i].split('|').map(s => s.trim()).filter(Boolean);
        if (rowCells.length > 0) {
          tableRows.push(rowCells);
        }
        i++;
      }

      elements.push(
        <div key={`table-${i}`} className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                {headers.map((h, hIdx) => (
                  <th key={hIdx} className="px-3.5 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-orange-50/40 dark:hover:bg-slate-800/40 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3.5 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {renderFormattedLine(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 2. Headers (#, ##, ###)
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={i} className="text-sm font-bold text-slate-900 dark:text-white mt-3 mb-1">
          {renderFormattedLine(line.substring(4))}
        </h4>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={i} className="text-base font-bold text-slate-900 dark:text-white mt-4 mb-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
          {renderFormattedLine(line.substring(3))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h2 key={i} className="text-lg font-extrabold text-slate-900 dark:text-white mt-4 mb-2">
          {renderFormattedLine(line.substring(2))}
        </h2>
      );
      i++;
      continue;
    }

    // 3. Bullet points (* or -)
    if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
      const listItems = [];
      while (i < lines.length && (lines[i].trim().startsWith('* ') || lines[i].trim().startsWith('- '))) {
        const itemText = lines[i].trim().substring(2);
        listItems.push(itemText);
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1.5 list-disc list-inside text-sm text-slate-700 dark:text-slate-300">
          {listItems.map((item, lIdx) => (
            <li key={lIdx} className="leading-relaxed">
              <span className="inline">{renderFormattedLine(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 4. Numbered list (1. 2. 3.)
    if (/^\d+\.\s/.test(line.trim())) {
      const listItems = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^\d+\.\s/, '');
        listItems.push(itemText);
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-2 space-y-1.5 list-decimal list-inside text-sm text-slate-700 dark:text-slate-300">
          {listItems.map((item, lIdx) => (
            <li key={lIdx} className="leading-relaxed">
              <span className="inline">{renderFormattedLine(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 5. Normal text or empty line
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 my-1">
          {renderFormattedLine(line)}
        </p>
      );
    }
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}
