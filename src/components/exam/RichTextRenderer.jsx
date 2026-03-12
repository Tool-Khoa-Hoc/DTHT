import React from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';

export default function RichTextRenderer({ content }) {
    if (!content) return null;

    const textStr = String(content);
    // Split by custom image tag
    const imgRegex = /(\$\/image_[^$]+\$)/g;
    const parts = textStr.split(imgRegex);

    return (
        <span className="rich-text font-medium leading-relaxed">
            {parts.map((part, index) => {
                // If it's an image tag
                if (part.startsWith('$/image_') && part.endsWith('$')) {
                    const inner = part.slice(8, -1);
                    const tokens = inner.split('_');
                    const type = tokens.pop();
                    const width = tokens.pop();
                    const align = tokens.pop();
                    const url = tokens.join('_');

                    const style = {
                         width: width && width !== 'none' ? `${width}%` : 'auto',
                         maxWidth: '100%',
                    };
                    
                    if (align === 'center') {
                         style.margin = '0 auto';
                         style.display = 'block';
                    }

                    return (
                        <div key={index} className="my-6 w-full flex justify-center">
                             <img src={url} alt="Question Resource" style={style} className={`rounded-xl shadow-md border border-slate-200 object-contain ${align === 'center' ? 'mx-auto' : ''}`} />
                        </div>
                    );
                }

                // If it's normal text, split by newlines
                // Handle both explicit \n and actual newlines
                const lines = part.split(/\\n|\n/);
                
                return (
                    <React.Fragment key={index}>
                        {lines.map((line, lIndex) => {
                            // Now parse Math inside each line
                            const mathRegex = /(\$[^$]+\$)/g;
                            const mathParts = line.split(mathRegex);

                            const renderedLine = mathParts.map((mPart, mIndex) => {
                                if (mPart.startsWith('$') && mPart.endsWith('$')) {
                                     const mathExp = mPart.slice(1, -1);
                                     return <InlineMath key={mIndex} math={mathExp} />;
                                }
                                
                                let htmlSafePart = mPart.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                                
                                return <span key={mIndex} dangerouslySetInnerHTML={{ __html: htmlSafePart }} />;
                            });

                            return (
                                <React.Fragment key={lIndex}>
                                    {renderedLine}
                                    {lIndex < lines.length - 1 && <br />}
                                </React.Fragment>
                            );
                        })}
                    </React.Fragment>
                );
            })}
        </span>
    );
}
