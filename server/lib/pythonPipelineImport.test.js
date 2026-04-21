import test from 'node:test';
import assert from 'node:assert/strict';

import {
  convertPythonPrivateToServerPrivate,
  convertPythonPublicToServerPublic,
  stripMarkupToRawText,
} from './pythonPipelineImport.js';

test('convertPythonPublicToServerPublic normalizes python block schema', () => {
  const pyPublic = {
    title: 'Demo Exam',
    assets: {
      images: {
        img_1: { source: 'data:image/png;base64,AAA=' },
      },
    },
    parts: [
      {
        id: 'part1',
        name: 'PHẦN I',
        type: 'single_choice',
        questions: [
          {
            id: 'part1.q1',
            source_number: 1,
            type: 'single_choice',
            stem_blocks: [
              {
                type: 'paragraph',
                inlines: [
                  { type: 'text', text: 'Gene ', marks: ['bold'] },
                  { type: 'text', text: 'lac', marks: ['italic'] },
                  { type: 'image', image_id: 'img_1' },
                ],
              },
              {
                type: 'table',
                rows: [
                  {
                    type: 'table_row',
                    cells: [
                      [{ type: 'text', text: 'A' }],
                      [{ type: 'text', text: 'B' }],
                    ],
                  },
                ],
              },
            ],
            choices: [
              {
                id: 'A',
                content_blocks: [
                  {
                    type: 'paragraph',
                    inlines: [{ type: 'math', latex: 'x^2' }],
                  },
                ],
              },
              {
                id: 'B',
                content_blocks: [
                  {
                    type: 'paragraph',
                    inlines: [{ type: 'text', text: 'Choice B' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const converted = convertPythonPublicToServerPublic(pyPublic);
  const question = converted.sections[0].questions[0];

  assert.equal(converted.sections[0].question_type, 'single_choice');
  assert.equal(question.stem_blocks[0].type, 'paragraph');
  assert.deepEqual(question.stem_blocks[0].children[0], { type: 'text', text: 'Gene ', marks: ['bold'] });
  assert.deepEqual(question.stem_blocks[0].children[1], { type: 'text', text: 'lac', marks: ['italic'] });
  assert.deepEqual(question.stem_blocks[0].children[2], { type: 'image', image_id: 'img_1' });
  assert.equal(question.stem_blocks[1].type, 'table');
  assert.deepEqual(question.stem_blocks[1].rows[0][0], [{ type: 'text', text: 'A' }]);
  assert.equal(question.options[0].content[0].children[0].type, 'math');
  assert.equal(question.options[0].content[0].children[0].text, 'x^2');
  assert.equal(question.assets[0].id, 'img_1');
});

test('convertPythonPrivateToServerPrivate maps answer keys by question type', () => {
  const examPublic = {
    sections: [
      {
        id: 'part1',
        title: 'PHẦN I',
        question_type: 'single_choice',
        questions: [{ id: 'part1.q1', type: 'single_choice' }],
      },
      {
        id: 'part2',
        title: 'PHẦN II',
        question_type: 'true_false_group',
        questions: [{ id: 'part2.q1', type: 'true_false_group' }],
      },
      {
        id: 'part3',
        title: 'PHẦN III',
        question_type: 'short_answer',
        questions: [{ id: 'part3.q1', type: 'short_answer' }],
      },
    ],
    assets: { images: {} },
  };

  const pyPrivate = {
    answer_key: {
      'part1.q1': 'B',
      'part2.q1': { a: true, b: false, c: true, d: false },
      'part3.q1': '0,25|0.25',
    },
  };

  const converted = convertPythonPrivateToServerPrivate(pyPrivate, examPublic, '[!b:$RAW$]');
  const [q1, q2, q3] = converted.question_keys;

  assert.deepEqual(q1.answer_key, { selected_option: 'B' });
  assert.deepEqual(q2.answer_key, { a: true, b: false, c: true, d: false });
  assert.deepEqual(q3.accepted_answers, ['0,25', '0.25']);
  assert.deepEqual(q3.normalization, { trim: true, lowercase: true });
  assert.equal(converted.import_data.raw_text, 'RAW');
});

test('stripMarkupToRawText removes azota style wrappers and preserves hard breaks', () => {
  const text = stripMarkupToRawText('[!b:$PHẦN I$]\n[!i:$Gene$] [img:$img_1$] [br] dong 2');
  assert.equal(text, 'PHẦN I\nGene [img:$img_1$]\ndong 2');
});
