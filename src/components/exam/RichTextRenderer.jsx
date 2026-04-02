import React from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

export default function RichTextRenderer({ content }) {
    if (!content) return null;

    const resolveNodeImageSource = (node) => {
        if (!node || typeof node !== 'object') return '';
        const candidates = [node.image, node.src, node.url, node.source];
        for (const candidate of candidates) {
            if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
        }
        return '';
    };

    const normalizeLatex = (input) => {
        let latex = String(input ?? '').trim();
        if (!latex) return '';
        if (latex.startsWith('[math:$') && latex.endsWith('$]')) {
            latex = latex.slice(7, -2);
        } else if (latex.startsWith('[!m:$') && latex.endsWith('$]')) {
            latex = latex.slice(5, -2);
        } else if (latex.startsWith('$') && latex.endsWith('$') && latex.length >= 2) {
            latex = latex.slice(1, -1);
        } else if (latex.startsWith('\\(') && latex.endsWith('\\)') && latex.length >= 4) {
            latex = latex.slice(2, -2);
        } else if (latex.startsWith('\\[') && latex.endsWith('\\]') && latex.length >= 4) {
            latex = latex.slice(2, -2);
        }
        return latex.trim();
    };

    const renderInlineMathNode = (rawMath, key) => {
        const math = normalizeLatex(rawMath);
        return (
            <InlineMath
                key={key}
                math={math}
                renderError={() => (
                    <code className="px-1 rounded bg-slate-100 text-slate-700">{`$${math}$`}</code>
                )}
            />
        );
    };

    const renderBlockMathNode = (rawMath, key) => {
        const math = normalizeLatex(rawMath);
        return (
            <BlockMath
                key={key}
                math={math}
                renderError={() => (
                    <pre className="whitespace-pre-wrap px-3 py-2 rounded bg-slate-100 text-slate-700">{`$${math}$`}</pre>
                )}
            />
        );
    };

    const renderFormattedText = (text, keyPrefix) => {
        // Handle literal newlines or escaped \n
        const lines = String(text).split(/\\n|\n/);

        return lines.map((line, lIdx) => {
            // Match bold, inline math, and legacy inline style/math tokens.
            const parts = line
                .split(/(\*\*.*?\*\*|\[(?:math|!m):\$[\s\S]*?\$\]|\[!(?:sup|sub|b|i):\$[\s\S]*?\$\]|\[img:\$[^$]+\$\]|\$.*?\$)/g)
                .filter(Boolean);

            const renderedLine = parts.map((part, idx) => {
                const boldMatch = part.match(/^\*\*(.*)\*\*$/s);
                if (boldMatch) {
                    return <strong key={`${keyPrefix}-${lIdx}-bold-${idx}`}>{boldMatch[1]}</strong>;
                }

                const inlineMathToken = part.match(/^\[(?:math|!m):\$(.*)\$\]$/s);
                if (inlineMathToken) {
                    return renderInlineMathNode(inlineMathToken[1], `${keyPrefix}-${lIdx}-math-token-${idx}`);
                }

                const styleToken = part.match(/^\[!(sup|sub|b|i):\$(.*)\$\]$/s);
                if (styleToken) {
                    const mark = styleToken[1];
                    const inner = renderFormattedText(styleToken[2], `${keyPrefix}-${lIdx}-style-${idx}`);
                    if (mark === 'sup') return <sup key={`${keyPrefix}-${lIdx}-sup-${idx}`}>{inner}</sup>;
                    if (mark === 'sub') return <sub key={`${keyPrefix}-${lIdx}-sub-${idx}`}>{inner}</sub>;
                    if (mark === 'b') return <strong key={`${keyPrefix}-${lIdx}-b-${idx}`}>{inner}</strong>;
                    if (mark === 'i') return <em key={`${keyPrefix}-${lIdx}-i-${idx}`}>{inner}</em>;
                }

                const mathMatch = part.match(/^\$(.*)\$$/s);
                if (mathMatch) {
                    return renderInlineMathNode(mathMatch[1], `${keyPrefix}-${lIdx}-math-${idx}`);
                }

                const imageMatch = part.match(/^\[img:\$([^$]+)\$\]$/i);
                if (imageMatch) {
                    const imageSrc = imageMatch[1]?.trim();
                    if (!imageSrc) return null;
                    // Render when token already contains a real path/url; keep token text otherwise.
                    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i.test(imageSrc) || /\.[a-z0-9]{2,5}(?:[?#].*)?$/i.test(imageSrc)) {
                        return (
                            <img
                                key={`${keyPrefix}-${lIdx}-img-${idx}`}
                                src={imageSrc}
                                alt="Question Resource"
                                className="inline-block max-w-full rounded border border-slate-200 align-middle"
                            />
                        );
                    }
                    return <code key={`${keyPrefix}-${lIdx}-img-token-${idx}`} className="px-1 rounded bg-slate-100 text-slate-700">{part}</code>;
                }

                return <React.Fragment key={`${keyPrefix}-${lIdx}-text-${idx}`}>{part}</React.Fragment>;
            });

            return (
                <React.Fragment key={`${keyPrefix}-line-${lIdx}`}>
                    {renderedLine}
                    {lIdx < lines.length - 1 && <br />}
                </React.Fragment>
            );
        });
    };

    const isInlineNode = (node) => {
        if (typeof node === 'string') return true;
        if (!node || Array.isArray(node)) return false;
        return (
            node.math !== undefined ||
            node.blank !== undefined ||
            node.type === 'text' ||
            node.type === 'math' ||
            node.type === 'blank'
        );
    };

    const isInlineArray = (value) => Array.isArray(value) && value.every(isInlineNode);
    const isEmptyInlineNode = (node) => {
        if (typeof node === 'string') return node.trim() === '';
        if (!node || Array.isArray(node)) return false;
        if (node.type === 'text') return String(node.text || '').trim() === '';
        return false;
    };

    const isTopLevelInlineLike = (node) => {
        if (typeof node === 'string') return true;
        if (!node) return false;
        if (Array.isArray(node)) return false;

        return (
            node.math !== undefined ||
            node.blank !== undefined ||
            node.type === 'text' ||
            node.type === 'math' ||
            node.type === 'blank'
        );
    };

    const normalizeTopLevelBlocks = (blocks) => {
        const normalized = [];
        let inlineBuffer = [];

        const flushInlineBuffer = () => {
            if (!inlineBuffer.length) return;
            if (inlineBuffer.every(isEmptyInlineNode)) {
                inlineBuffer = [];
                return;
            }
            normalized.push(inlineBuffer);
            inlineBuffer = [];
        };

        blocks.forEach((block) => {
            if (isTopLevelInlineLike(block)) {
                inlineBuffer.push(block);
                return;
            }

            flushInlineBuffer();
            normalized.push(block);
        });

        flushInlineBuffer();
        return normalized;
    };

    // Helper to render inline nodes like Text and Math
    const renderInlineNode = (node, index) => {
        // Shorthand for simple string
        if (typeof node === 'string') {
            return <span key={index}>{renderFormattedText(node, `inline-${index}`)}</span>;
        }

        // Shorthand formats
        if (node.math !== undefined) {
            if (node.display === 'block') {
                return renderBlockMathNode(node.math || '', index);
            }
            return renderInlineMathNode(node.math || '', index);
        }
        if (node.blank !== undefined) {
            return (
                <span key={index} className="inline-block border-b-2 border-slate-300 min-w-[3rem] px-2 text-center text-slate-400">
                    {node.blank || '...'}
                </span>
            );
        }

        // Legacy / Verbose format
        if (node.type === 'text') {
            let rendered = renderFormattedText(node.text || '', `legacy-text-${index}`);
            if (node.marks && Array.isArray(node.marks)) {
                node.marks.forEach((mark, mIdx) => {
                    if (mark === 'sup') rendered = <sup key={`${index}-${mIdx}`}>{rendered}</sup>;
                    if (mark === 'sub') rendered = <sub key={`${index}-${mIdx}`}>{rendered}</sub>;
                    if (mark === 'italic') rendered = <em key={`${index}-${mIdx}`}>{rendered}</em>;
                    if (mark === 'bold') rendered = <strong key={`${index}-${mIdx}`}>{rendered}</strong>;
                });
            }
            return <span key={index}>{rendered}</span>;
        }
        if (node.type === 'math') {
            const mathValue = node.text || node.latex || node.math || '';
            if (node.display === 'block') {
                return renderBlockMathNode(mathValue, index);
            }
            return renderInlineMathNode(mathValue, index);
        }
        if (node.type === 'image') {
            const src = resolveNodeImageSource(node);
            if (!src) return null;
            return (
                <img
                    key={index}
                    src={src}
                    alt={node.alt || "Question Resource"}
                    className="inline-block max-w-full rounded border border-slate-200 align-middle"
                />
            );
        }
        if (node.type === 'blank') {
            return (
                <span key={index} className="inline-block border-b-2 border-slate-300 min-w-[3rem] px-2 text-center text-slate-400">
                    {node.text || node.id || '...'}
                </span>
            );
        }
        return null;
    };

    // Helper to render top-level blocks
    const renderBlock = (block, index) => {
        if (!block) return null;

        // Shorthand for paragraph containing only a single string
        if (typeof block === 'string') {
            if (block.trim() === '') return null;
            return <p key={index} className="mb-2">{renderInlineNode(block, 0)}</p>;
        }

        // Shorthand for paragraph with mixed children (array)
        if (Array.isArray(block)) {
            if (block.every(isEmptyInlineNode)) return null;
            return (
                <p key={index} className="mb-2 inline-block w-full">
                    {block.map((child, idx) => renderInlineNode(child, idx))}
                </p>
            );
        }

        // Shorthand for image
        if (block.image !== undefined) {
            const source = resolveNodeImageSource(block);
            if (!source) return null;
            const style = {
                width: block.width && block.width !== 'none' ? `${block.width}%` : 'auto',
                maxWidth: '100%',
            };
            const alignClass = block.align === 'center' || !block.align ? 'mx-auto' : '';
            return (
                <div key={index} className={`my-6 w-full flex ${block.align === 'center' || !block.align ? 'justify-center' : ''}`}>
                    <img
                        src={source}
                        alt={block.alt || "Question Resource"}
                        style={style}
                        className={`rounded-xl shadow-md border border-slate-200 object-contain ${alignClass}`}
                    />
                </div>
            );
        }

        // Verbose Top level blocks
        if (block.type === 'paragraph') {
            return (
                <p key={index} className="mb-2 inline-block w-full">
                    {block.children?.map((child, idx) => renderInlineNode(child, idx))}
                </p>
            );
        }
        if (block.type === 'image') {
            const source = resolveNodeImageSource(block);
            if (!source) return null;
            const style = {
                width: block.width && block.width !== 'none' ? `${block.width}%` : 'auto',
                maxWidth: '100%',
            };
            const alignClass = block.align === 'center' || !block.align ? 'mx-auto' : '';
            return (
                <div key={index} className={`my-6 w-full flex ${block.align === 'center' || !block.align ? 'justify-center' : ''}`}>
                    <img
                        src={source}
                        alt={block.alt || "Question Resource"}
                        style={style}
                        className={`rounded-xl shadow-md border border-slate-200 object-contain ${alignClass}`}
                    />
                </div>
            );
        }
        if (block.type === 'group') {
            return (
                <div key={index} className="p-4 rounded-xl bg-slate-50 border border-slate-200 mb-6">
                    {block.children?.map((childBlock, idx) => renderBlock(childBlock, idx))}
                </div>
            );
        }

        // Table support
        if (block.type === 'table') {
            return (
                <div key={index} className="my-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5">
                    <table className="w-full border-collapse text-[13px] sm:text-sm text-center">
                        <tbody className="divide-y divide-slate-200">
                            {block.rows?.map((row, rowIdx) => {
                                // A row that was completely swallowed by rowspans will have no cells
                                if (!row || row.length === 0) return null;
                                
                                return (
                                    <tr key={rowIdx} className="divide-x divide-slate-200 hover:bg-slate-50/20 transition-colors">
                                        {row.map((cellData, cellIdx) => {
                                            const isObjectCell = cellData && typeof cellData === 'object' && !Array.isArray(cellData) && cellData.content !== undefined;
                                            const actualCell = isObjectCell ? cellData.content : cellData;
                                            const colSpan = isObjectCell ? cellData.colspan : 1;
                                            const rowSpan = isObjectCell ? cellData.rowspan : 1;
                                            
                                            return (
                                                <td
                                                    key={cellIdx}
                                                    colSpan={colSpan > 1 ? colSpan : undefined}
                                                    rowSpan={rowSpan > 1 ? rowSpan : undefined}
                                                    className={`p-3 transition-colors ${rowIdx === 0 ? 'bg-slate-50/80 font-bold text-slate-700' : 'text-slate-600'}`}
                                                >
                                                    <div className="flex flex-wrap items-center justify-center gap-1.5 leading-relaxed min-h-[1.5rem] min-w-[3rem]">
                                                        {Array.isArray(actualCell)
                                                            ? actualCell.map((nc, ni) => renderInlineNode(nc, ni))
                                                            : renderInlineNode(actualCell, 0)}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            );
        }

        // Automatically wrap stray inline nodes at the top level
        if (block.type === 'math' || block.type === 'text' || block.type === 'blank' || block.math !== undefined || block.blank !== undefined) {
             return <p key={index} className="mb-2 inline-block w-full">{renderInlineNode(block, 0)}</p>;
        }

        return null;
    };

    // If content is our new nested block schema
    if (Array.isArray(content)) {
        if (isInlineArray(content)) {
            return (
                <div className="rich-text font-medium leading-relaxed">
                    {renderBlock(content, 0)}
                </div>
            );
        }

        const normalizedBlocks = normalizeTopLevelBlocks(content);

        return (
            <div className="rich-text font-medium leading-relaxed">
                {normalizedBlocks.map((block, index) => renderBlock(block, index))}
            </div>
        );
    }

    if (typeof content === 'object') {
        return (
            <div className="rich-text font-medium leading-relaxed">
                {renderBlock(content, 0)}
            </div>
        );
    }

    // Fallback: simple string (legacy)
    const textStr = String(content);
    const lines = textStr.split(/\\n|\n/);
    return (
        <span className="rich-text font-medium leading-relaxed">
            {lines.map((line, lIndex) => {
                return (
                    <React.Fragment key={lIndex}>
                        <span>{renderFormattedText(line, `line-${lIndex}`)}</span>
                        {lIndex < lines.length - 1 && <br />}
                    </React.Fragment>
                );
            })}
        </span>
    );
}
