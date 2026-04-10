const fs = require('fs');
const path = require('path');

const filePath = 'd:/DTHT/public/data/exams/toan/le-thanh-tong-tp-hcm-2026/exam.json';
const content = fs.readFileSync(filePath, 'utf8');

// Find non-printable characters except newline, tab, etc.
const hasBadChars = /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(content);

if (hasBadChars) {
    console.log('Found bad characters! Cleaning...');
    const cleaned = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    fs.writeFileSync(filePath, cleaned);
    console.log('Cleaned and saved.');
} else {
    console.log('No bad characters found (0-31 range).');
}
