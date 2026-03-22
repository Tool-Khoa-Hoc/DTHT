import test from 'node:test';
import assert from 'node:assert/strict';

import {
  blocksToEditableText,
  buildAssetListFromContent,
  editableTextToBlocks,
  extractTableBlocksFromBlocks,
} from './examBlockText.js';

test('editableTextToBlocks preserves raw table rows and inline hard breaks', () => {
  const blocks = editableTextToBlocks(
    'Câu 1. Dữ liệu ở bảng dưới đây\n[* Hàng 1 [br] dòng 2 | [img:$img_1$] *]',
  );

  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(blocks[1].type, 'table');
  assert.equal(blocks[1].rows[0][0][0].text, 'Hàng 1\ndòng 2');
  assert.deepEqual(blocks[1].rows[0][1][0], { type: 'image', image_id: 'img_1' });
});

test('blocksToEditableText and asset extraction round-trip table content', () => {
  const sourceBlocks = [
    {
      type: 'paragraph',
      children: [{ type: 'text', text: 'Câu 2. Chọn đáp án đúng.' }],
    },
    {
      type: 'table',
      rows: [
        [
          [{ type: 'text', text: 'A\nB' }],
          [{ type: 'image', image_id: 'img_2' }],
        ],
      ],
    },
  ];

  const text = blocksToEditableText(sourceBlocks);
  const rebuilt = editableTextToBlocks(text);
  const tableBlocks = extractTableBlocksFromBlocks(rebuilt);
  const assets = buildAssetListFromContent(rebuilt, tableBlocks);

  assert.match(text, /\[\* A \[br\] B \| \[img:\$img_2\$\] \*\]/);
  assert.equal(tableBlocks.length, 1);
  assert.deepEqual(assets, [{ type: 'image', id: 'img_2' }]);
});

test('canonical inline math round-trips without becoming a fake asset ref', () => {
  const blocks = editableTextToBlocks('Câu 3. Công thức:\n[math:$x^2$]\n[img:$img_math$]');
  const text = blocksToEditableText(blocks);
  const assets = buildAssetListFromContent(blocks);

  assert.match(text, /\[math:\$x\^2\$\]/);
  assert.deepEqual(assets, [{ type: 'image', id: 'img_math' }]);
});
