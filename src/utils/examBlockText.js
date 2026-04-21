const TABLE_ROW_RE = /^\[\*\s*(.*?)\s*\*\]$/;
const MARKDOWN_TABLE_RE = /^\s*\|(.+)\|\s*$/;
const TABLE_DIVIDER_RE = /^\s*:?-{2,}:?\s*$/;
const BREAK_TOKEN_RE = /\s*(?:\[br\]|<br\s*\/?>)\s*/gi;
const INLINE_TOKEN_SPLIT_RE = /(\[!b:\$[\s\S]*?\$\]|\[!b:[^\]]+\]|\[!i:\$[\s\S]*?\$\]|\[!i:[^\]]+\]|\[!sub:\$[\s\S]*?\$\]|\[!sub:[^\]]+\]|\[!sup:\$[\s\S]*?\$\]|\[!sup:[^\]]+\]|\[math:\$[\s\S]*?\$\]|\[!m:\$[\s\S]*?\$\]|\[img:\$[^$]+\$\])/g;

function wrapMarksAsTokens(text, marks) {
  let value = String(text ?? '');
  for (const mark of Array.isArray(marks) ? marks : []) {
    const normalized = String(mark || '').toLowerCase();
    if (!value) continue;
    if (normalized === 'bold') value = `[!b:$${value}$]`;
    else if (normalized === 'italic') value = `[!i:$${value}$]`;
    else if (normalized === 'sub') value = `[!sub:$${value}$]`;
    else if (normalized === 'sup') value = `[!sup:$${value}$]`;
  }
  return value;
}

function normalizeInlineBreaks(text) {
  return String(text ?? '').replace(/\r/g, '').replace(BREAK_TOKEN_RE, '\n');
}

function stringifyInlineNode(node, { forTableCell = false } = {}) {
  if (typeof node === 'string') {
    return forTableCell
      ? normalizeInlineBreaks(node).replace(/\n/g, ' [br] ')
      : normalizeInlineBreaks(node);
  }

  if (!node || typeof node !== 'object') return '';

  if (node.math !== undefined) {
    return `[math:$${String(node.math || '')}$]`;
  }
  if (node.blank !== undefined) {
    return String(node.blank || node.id || '...');
  }

  const type = String(node.type || '').toLowerCase();
  if (type === 'text') {
    const rendered = wrapMarksAsTokens(normalizeInlineBreaks(node.text || ''), node.marks);
    return forTableCell ? rendered.replace(/\n/g, ' [br] ') : rendered;
  }
  if (type === 'math') {
    return `[math:$${String(node.text || node.latex || '')}$]`;
  }
  if (type === 'image') {
    const imageId = String(node.image_id || '').trim();
    return imageId ? `[img:$${imageId}$]` : '';
  }
  if (type === 'blank') {
    return String(node.text || node.id || '...');
  }

  if (typeof node.text === 'string') {
    const rendered = wrapMarksAsTokens(normalizeInlineBreaks(node.text), node.marks);
    return forTableCell ? rendered.replace(/\n/g, ' [br] ') : rendered;
  }
  return '';
}

function inlineNodesToText(nodes, options = {}) {
  if (!Array.isArray(nodes)) return stringifyInlineNode(nodes, options);
  return nodes.map((node) => stringifyInlineNode(node, options)).join('');
}

function parseInlineTextToNodes(text) {
  const value = String(text ?? '');
  if (!value) return [];

  const parts = value.split(INLINE_TOKEN_SPLIT_RE);
  const nodes = [];

  for (const part of parts) {
    if (!part) continue;

    const styleMatch = part.match(/^\[!(b|i|sub|sup):(?:\$([\s\S]*?)\$|([^\]]+))\]$/i);
    if (styleMatch) {
      const markMap = {
        b: 'bold',
        i: 'italic',
        sub: 'sub',
        sup: 'sup',
      };
      nodes.push({
        type: 'text',
        text: normalizeInlineBreaks(styleMatch[2] ?? styleMatch[3] ?? ''),
        marks: [markMap[styleMatch[1].toLowerCase()]],
      });
      continue;
    }

    const mathMatch = part.match(/^\[(?:math|!m):\$([\s\S]*?)\$\]$/i);
    if (mathMatch) {
      nodes.push({ type: 'math', text: mathMatch[1] });
      continue;
    }

    const imageMatch = part.match(/^\[img:\$([^$]+)\$\]$/i);
    if (imageMatch) {
      nodes.push({ type: 'image', image_id: imageMatch[1] });
      continue;
    }

    nodes.push({ type: 'text', text: normalizeInlineBreaks(part) });
  }

  return nodes.filter((node) => {
    if (!node || typeof node !== 'object') return false;
    if (node.type === 'text') return String(node.text ?? '').length > 0;
    return true;
  });
}

function normalizeTableRowText(rawLine) {
  const raw = String(rawLine || '').trim();
  const rawMatch = TABLE_ROW_RE.exec(raw);
  if (rawMatch) {
    return `[* ${rawMatch[1].split('|').map((cell) => cell.trim()).join(' | ')} *]`;
  }

  const markdownMatch = MARKDOWN_TABLE_RE.exec(raw);
  if (markdownMatch) {
    const cells = markdownMatch[1].split('|').map((cell) => cell.trim());
    if (cells.length > 0 && cells.every((cell) => TABLE_DIVIDER_RE.test(cell))) {
      return null;
    }
    return `[* ${cells.join(' | ')} *]`;
  }

  return null;
}

export function editableTextToBlocks(text) {
  const lines = String(text ?? '').replace(/\r/g, '').split('\n');
  const blocks = [];
  let tableRows = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;
    blocks.push({ type: 'table', rows: tableRows });
    tableRows = [];
  };

  for (const rawLine of lines) {
    const line = String(rawLine ?? '');
    const trimmed = line.trim();
    if (!trimmed) {
      flushTable();
      continue;
    }

    const normalizedTableRow = normalizeTableRowText(trimmed);
    if (normalizedTableRow) {
      const rowMatch = TABLE_ROW_RE.exec(normalizedTableRow);
      const cells = (rowMatch?.[1] || '')
        .split('|')
        .map((cell) => parseInlineTextToNodes(cell.trim()));
      tableRows.push(cells);
      continue;
    }

    flushTable();
    blocks.push({
      type: 'paragraph',
      children: parseInlineTextToNodes(line),
    });
  }

  flushTable();
  return blocks;
}

export function blocksToEditableText(blocks) {
  if (!Array.isArray(blocks)) return '';

  const blockStrings = blocks
    .map((block) => {
      if (typeof block === 'string') return normalizeInlineBreaks(block);
      if (!block || typeof block !== 'object') return '';
      if (Array.isArray(block)) return inlineNodesToText(block);

      const type = String(block.type || '').toLowerCase();
      if (type === 'paragraph') {
        const children = Array.isArray(block.children)
          ? block.children
          : (Array.isArray(block.inlines) ? block.inlines : []);
        return inlineNodesToText(children);
      }
      if (type === 'table') {
        return (Array.isArray(block.rows) ? block.rows : [])
          .map((row) => {
            const cells = Array.isArray(row)
              ? row
              : (Array.isArray(row?.cells) ? row.cells : []);
            const renderedCells = cells.map((cell) => inlineNodesToText(cell, { forTableCell: true }).trim());
            return `[* ${renderedCells.join(' | ')} *]`;
          })
          .join('\n');
      }
      if (type === 'image' || type === 'math' || type === 'text' || type === 'blank') {
        return stringifyInlineNode(block);
      }
      if (type === 'group') {
        return blocksToEditableText(Array.isArray(block.children) ? block.children : []);
      }
      return '';
    })
    .filter(Boolean);

  return blockStrings.join('\n').trim();
}

export function extractTableBlocksFromBlocks(blocks) {
  return Array.isArray(blocks)
    ? blocks.filter((block) => block && typeof block === 'object' && block.type === 'table')
    : [];
}

function collectAssetRefs(value, target) {
  if (!value) return;

  if (typeof value === 'string') {
    const imageMatches = value.match(/\[img:\$([^$]+)\$\]/g) || [];
    const mathMatches = value.match(/\[!m:\$([^$]+)\$\]/g) || [];
    for (const token of imageMatches) {
      const match = token.match(/\[img:\$([^$]+)\$\]/);
      if (match?.[1]) target.add(`image:${match[1]}`);
    }
    for (const token of mathMatches) {
      const match = token.match(/\[!m:\$([^$]+)\$\]/);
      if (match?.[1]) target.add(`math:${match[1]}`);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectAssetRefs(item, target);
    return;
  }

  if (typeof value === 'object') {
    if (typeof value.image_id === 'string' && value.image_id.trim()) {
      target.add(`image:${value.image_id.trim()}`);
    }
    if (typeof value.math_id === 'string' && value.math_id.trim()) {
      target.add(`math:${value.math_id.trim()}`);
    }
    for (const nested of Object.values(value)) collectAssetRefs(nested, target);
  }
}

export function buildAssetListFromContent(...values) {
  const refs = new Set();
  for (const value of values) collectAssetRefs(value, refs);
  return Array.from(refs).map((ref) => {
    const [type, id] = ref.split(':');
    return { type, id };
  });
}
