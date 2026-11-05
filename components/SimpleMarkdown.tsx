import React from 'react';

// מציג טקסט שנכתב ב-Markdown פשוט (כותרות ##, רשימות * / - / •, הדגשה **) בלי להציג את הסימנים עצמם
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={i} className="font-black text-gray-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part.replace(/\*\*/g, '')
    )
  );
}

export default function SimpleMarkdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let ordered = false;

  const flushList = () => {
    if (list.length) {
      const items = list.map((item, i) => <li key={i}>{inline(item)}</li>);
      blocks.push(
        ordered ? (
          <ol key={`l${blocks.length}`} className="list-decimal pr-5 space-y-1">
            {items}
          </ol>
        ) : (
          <ul key={`l${blocks.length}`} className="list-disc pr-5 space-y-1">
            {items}
          </ul>
        )
      );
      list = [];
    }
  };

  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const bullet = line.match(/^[*\-•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (heading) {
      flushList();
      blocks.push(
        <h3 key={`h${blocks.length}`} className="text-sm sm:text-base font-black text-gray-900 pt-2">
          {inline(heading[1])}
        </h3>
      );
    } else if (bullet || numbered) {
      // רשימה ממוספרת ורשימת נקודות לא מתערבבות
      if (list.length && ordered !== !!numbered) flushList();
      ordered = !!numbered;
      list.push((bullet || numbered)![1]);
    } else if (line) {
      flushList();
      blocks.push(<p key={`p${blocks.length}`}>{inline(line)}</p>);
    } else {
      flushList();
    }
  }
  flushList();

  return <div className="space-y-2">{blocks}</div>;
}
