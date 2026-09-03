import React from "react";
import ReactMarkdown from "react-markdown";

export default function HebrewMarkdown({ content, className = "" }) {
  return (
    <div className={`prose-hebrew text-[15px] leading-relaxed text-foreground ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="text-xl font-heading font-semibold mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-heading font-semibold mt-4 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-heading font-semibold mt-3 mb-1.5">{children}</h3>,
          p: ({ children }) => <p className="mb-3 leading-[1.85]">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pr-5 mb-3 space-y-1.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pr-5 mb-3 space-y-1.5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
          hr: () => <hr className="my-4 border-border" />,
          code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm">{children}</code>
        }}
      >
        {content || ""}
      </ReactMarkdown>
    </div>
  );
}