import fs from 'fs';
import path from 'path';

function compactInline(node) {
    if (node.type === 'text') {
        return node.text;
    }
    if (node.type === 'math') {
        if (node.display === 'block') {
            return { math: node.text, display: 'block' };
        }
        return { math: node.text };
    }
    if (node.type === 'blank') {
         return { blank: node.text || node.id };
    }
    return node;
}

function compactBlock(block) {
    if (block.type === 'paragraph') {
        if (!block.children || block.children.length === 0) return "";
        if (block.children.length === 1 && block.children[0].type === 'text') {
            return block.children[0].text;
        }
        return block.children.map(compactInline);
    }
    if (block.type === 'image') {
        const compacted = { image: block.src };
        if (block.align) compacted.align = block.align;
        if (block.width) compacted.width = block.width;
        if (block.alt) compacted.alt = block.alt;
        return compacted;
    }
    if (block.type === 'group') {
        return { group: block.children.map(compactBlock) };
    }
    
    // In case the block is already compacted or is a rogue inline node, try converting it
    if (block.type === 'math' || block.type === 'text' || block.type === 'blank') {
         return compactInline(block);
    }
    
    return block;
}

function compactArray(arr) {
    return arr.map(compactBlock);
}

const examPath = path.join(process.cwd(), 'public', 'data', 'exams', 'toan', 'thptqg-toan-2025-01', 'exam.json');

try {
    const data = JSON.parse(fs.readFileSync(examPath, 'utf8'));

    // Recursively walk and compact
    data.parts.forEach(part => {
        part.questions.forEach(q => {
            if (Array.isArray(q.content)) {
                q.content = compactArray(q.content);
            }
            if (Array.isArray(q.options)) {
                q.options = q.options.map(opt => Array.isArray(opt) ? compactArray(opt) : opt);
            }
            if (Array.isArray(q.statements)) {
                 q.statements.forEach(st => {
                     if (Array.isArray(st.content)) {
                         st.content = compactArray(st.content);
                     }
                 });
            }
        });
    });

    fs.writeFileSync(examPath, JSON.stringify(data, null, 2));
    console.log("Compacted JSON successfully.");
} catch (e) {
    console.error(e);
}
