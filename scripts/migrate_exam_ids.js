/**
 * migrate_exam_ids.js
 * Normalize exam.json files: part.id, question.id, statement.id
 * Format chuẩn:
 *   - part.id: "part-1", "part-2", "part-3"
 *   - question.id: thuần số, reset về 1 trong mỗi part  
 *   - statement.id: "a", "b", "c", "d"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXAMS_BASE = path.join(__dirname, '..', 'public', 'data', 'exams');

// Normalize part.id: "part1" → "part-1", "part2" → "part-2" etc.
function normalizePartId(id) {
  if (!id) return id;
  const s = String(id).trim().toLowerCase();
  // Already canonical: "part-1", "part-2", "part-3"
  if (/^part-[123]$/.test(s)) return s;
  // "part1" → "part-1"
  const m = s.match(/^part_?([123])$/);
  if (m) return `part-${m[1]}`;
  return id;
}

// Normalize question.id: "q13" → the new sequential number within part
// Returns a string number like "1", "2", etc.
function normalizeQuestionId(rawId) {
  if (!rawId) return rawId;
  const s = String(rawId).trim().toLowerCase();
  // Already a plain number: "1", "13", etc.
  if (/^[0-9]+$/.test(s)) return s;
  // "q13" → "13"
  const m = s.match(/^q([0-9]+)$/);
  if (m) return m[1];
  return rawId;
}

// Normalize statement.id: "q13a" → "a", "q14b" → "b" etc.
function normalizeStatementId(rawId) {
  if (!rawId) return rawId;
  const s = String(rawId).trim().toLowerCase();
  // Already canonical: "a", "b", "c", "d"
  if (/^[a-d]$/.test(s)) return s;
  // "q13a" → "a", "q14b" → "b"
  const m = s.match(/^q?[0-9]*([a-d])$/);
  if (m) return m[1];
  return rawId;
}

function processExamFile(examJsonPath, dryRun = false) {
  const raw = fs.readFileSync(examJsonPath, 'utf-8');
  const exam = JSON.parse(raw);

  if (!Array.isArray(exam.parts)) {
    console.log(`  SKIP: no parts array`);
    return false;
  }

  let changed = false;
  const newParts = exam.parts.map(part => {
    const newPartId = normalizePartId(part.id);
    if (newPartId !== part.id) {
      console.log(`  part.id: "${part.id}" → "${newPartId}"`);
      changed = true;
    }

    // Reset question counter per part
    let qCounter = 0;
    const newQuestions = (part.questions || []).map(q => {
      qCounter++;
      const rawQId = normalizeQuestionId(q.id);
      const newQId = String(qCounter); // reset within part
      
      if (newQId !== q.id) {
        console.log(`  question.id: "${q.id}" → "${newQId}"`);
        changed = true;
      }

      // Normalize statements
      let newStatements = q.statements;
      if (Array.isArray(q.statements)) {
        newStatements = q.statements.map(stmt => {
          const newStmtId = normalizeStatementId(stmt.id);
          if (newStmtId !== stmt.id) {
            console.log(`    stmt.id: "${stmt.id}" → "${newStmtId}"`);
            changed = true;
          }
          return { ...stmt, id: newStmtId };
        });
      }

      return { ...q, id: newQId, statements: newStatements };
    });

    return { ...part, id: newPartId, questions: newQuestions };
  });

  if (!changed) {
    console.log(`  OK: no changes needed`);
    return false;
  }

  if (!dryRun) {
    const newExam = { ...exam, parts: newParts };
    fs.writeFileSync(examJsonPath, JSON.stringify(newExam, null, 2), 'utf-8');
    console.log(`  SAVED: ${examJsonPath}`);
  } else {
    console.log(`  DRY RUN: would save ${examJsonPath}`);
  }
  return true;
}

// Find all exam.json files that need migration (check for "q" prefix in ids)
function needsMigration(examJsonPath) {
  try {
    const raw = fs.readFileSync(examJsonPath, 'utf-8');
    const exam = JSON.parse(raw);
    if (!Array.isArray(exam.parts)) return false;
    
    for (const part of exam.parts) {
      // Check part.id format
      if (part.id && /^part[123]$/.test(String(part.id).toLowerCase())) return true;
      // Check question.id format
      for (const q of (part.questions || [])) {
        if (q.id && /^q[0-9]+$/.test(String(q.id).toLowerCase())) return true;
        // Check statement.id format
        for (const stmt of (q.statements || [])) {
          if (stmt.id && /^q[0-9]+[a-d]$/.test(String(stmt.id).toLowerCase())) return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

// Main
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
console.log(`Scanning: ${EXAMS_BASE}\n`);

let totalMigrated = 0;

// Walk subject folders
const subjects = fs.readdirSync(EXAMS_BASE).filter(f => {
  try { return fs.statSync(path.join(EXAMS_BASE, f)).isDirectory(); } catch { return false; }
});

for (const subject of subjects) {
  const subjectPath = path.join(EXAMS_BASE, subject);
  const exams = fs.readdirSync(subjectPath).filter(f => {
    try { return fs.statSync(path.join(subjectPath, f)).isDirectory(); } catch { return false; }
  });

  for (const examDir of exams) {
    const examJsonPath = path.join(subjectPath, examDir, 'exam.json');
    if (!fs.existsSync(examJsonPath)) continue;

    if (!needsMigration(examJsonPath)) continue;

    console.log(`\n[${subject}/${examDir}]`);
    const didChange = processExamFile(examJsonPath, dryRun);
    if (didChange) totalMigrated++;
  }
}

console.log(`\n✅ Done. ${totalMigrated} file(s) ${dryRun ? 'would be' : 'were'} migrated.`);
