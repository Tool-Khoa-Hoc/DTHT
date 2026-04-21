import fs from 'fs';
import path from 'path';

const filePath = path.join('d:', 'Web sv', 'tram_hs_sv', 'public', 'data', 'exams', 'sinh', 'han-thuyen', 'exam.json');

try {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const examData = JSON.parse(rawData);

    const answerKey = {
        "part1.q1": 2, // c
        "part1.q2": 2, // c
        "part1.q3": 0, // a
        "part1.q4": 2, // c
        "part1.q5": 2, // c
        "part1.q6": 2, // c
        "part1.q7": 2, // c
        "part1.q8": 0, // a
        "part1.q9": 2, // c
        "part1.q10": 2, // c
        "part1.q11": 0, // a
        "part1.q12": 1, // b
        "part1.q13": 3, // d
        "part1.q14": 0, // a
        "part1.q15": 2, // c
        "part1.q16": 3, // d
        "part1.q17": 2, // c
        "part1.q18": 3, // d

        "part2.q1": { "q1a": false, "q1b": false, "q1c": true, "q1d": true },
        "part2.q2": { "q2a": true, "q2b": false, "q2c": true, "q2d": true },
        "part2.q3": { "q3a": true, "q3b": false, "q3c": true, "q3d": true },
        "part2.q4": { "q4a": true, "q4b": true, "q4c": false, "q4d": false },

        "part3.q1": "0,19",
        "part3.q2": "2",
        "part3.q3": "3",
        "part3.q4": "0,45",
        "part3.q5": "1",
        "part3.q6": "3"
    };

    examData.answer_key = answerKey;
    
    // Add document resource link as specified by the user
    if (!examData.resources) {
        examData.resources = {};
    }
    examData.resources.answer_file_url = "https://drive.google.com/drive/folders/1BN654c95hjSma3cHRJ8Qzs_vB9kOjA0z";

    fs.writeFileSync(filePath, JSON.stringify(examData, null, 2), 'utf-8');
    console.log('Successfully updated exam.json');
} catch (error) {
    console.error('Error updating exam.json:', error);
}
