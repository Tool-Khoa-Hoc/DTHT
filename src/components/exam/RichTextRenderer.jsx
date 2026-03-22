import React from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

export default function RichTextRenderer({ content }) {
    if (!content) return null;

    const renderFormattedText = (text, keyPrefix) => {
        // Match bold (**...**) and inline math ($...$)
        const parts = String(text).split(/(\*\*.*?\*\*|\$.*?\$)/g).filter(Boolean);

        return parts.map((part, idx) => {
            const boldMatch = part.match(/^\*\*(.*)\*\*$/s);
            if (boldMatch) {
                return <strong key={`${keyPrefix}-bold-${idx}`}>{boldMatch[1]}</strong>;
            }

            const mathMatch = part.match(/^\$(.*)\$$/s);
            if (mathMatch) {
                return <InlineMath key={`${keyPrefix}-math-${idx}`} math={mathMatch[1]} />;
            }

            return <React.Fragment key={`${keyPrefix}-text-${idx}`}>{part}</React.Fragment>;
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
                return <BlockMath key={index} math={node.math || ''} />;
            }
            return <InlineMath key={index} math={node.math || ''} />;
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
            return <span key={index}>{renderFormattedText(node.text || '', `legacy-text-${index}`)}</span>;
        }
        if (node.type === 'math') {
            if (node.display === 'block') {
                return <BlockMath key={index} math={node.text || ''} />;
            }
            return <InlineMath key={index} math={node.text || ''} />;
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
            const style = {
                width: block.width && block.width !== 'none' ? `${block.width}%` : 'auto',
                maxWidth: '100%',
            };
            const alignClass = block.align === 'center' || !block.align ? 'mx-auto' : '';
            return (
                <div key={index} className={`my-6 w-full flex ${block.align === 'center' || !block.align ? 'justify-center' : ''}`}>
                    <img
                        src={block.image}
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
            const style = {
                width: block.width && block.width !== 'none' ? `${block.width}%` : 'auto',
                maxWidth: '100%',
            };
            const alignClass = block.align === 'center' || !block.align ? 'mx-auto' : '';
            return (
                <div key={index} className={`my-6 w-full flex ${block.align === 'center' || !block.align ? 'justify-center' : ''}`}>
                    <img
                        src={block.src}
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
                            {block.rows?.map((row, rowIdx) => (
                                <tr key={rowIdx} className="divide-x divide-slate-200 hover:bg-slate-50/20 transition-colors">
                                    {row.map((cell, cellIdx) => (
                                        <td
                                            key={cellIdx}
                                            className={`p-3 transition-colors ${rowIdx === 0 ? 'bg-slate-50/80 font-bold text-slate-700' : 'text-slate-600'}`}
                                        >
                                            <div className="flex flex-wrap items-center justify-center gap-1.5 leading-relaxed min-h-[1.5rem] min-w-[3rem]">
                                                {Array.isArray(cell)
                                                    ? cell.map((nc, ni) => renderInlineNode(nc, ni))
                                                    : renderInlineNode(cell, 0)}
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            ))}
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
