const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, 'src', 'pages', 'Admin.jsx');
let content = fs.readFileSync(adminPath, 'utf8');

// ==== 1. EXTRACT AdminSubjects ====
const subjStartToken = "{mainTab === 'subjects' && (";
const subjStartIndex = content.indexOf(subjStartToken);
let subjJSX = "";

if (subjStartIndex !== -1) {
    let openCount = 0;
    let subjEndIndex = -1;
    for (let i = subjStartIndex + subjStartToken.length - 1; i < content.length; i++) {
        if (content[i] === '(') openCount++;
        else if (content[i] === ')') {
            openCount--;
            if (openCount === 0 && content[i+1] === '}') {
                subjEndIndex = i + 2; break;
            }
        }
    }
    if (subjEndIndex !== -1) {
        subjJSX = content.substring(subjStartIndex, subjEndIndex);
        content = content.replace(subjJSX, "{mainTab === 'subjects' && <AdminSubjects isActive={mainTab === 'subjects'} />}");
    }
}

// Extract Subjects States
const subjStatesToRemove = [
  "const [examSubjects, setExamSubjects] = useState([]);",
  "const [loadingSubjects, setLoadingSubjects] = useState(false);",
  "const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);",
  "const [editingSubject, setEditingSubject] = useState(null);",
  "const [subjectForm, setSubjectForm] = useState({ id: '', name: '', icon: 'folder', color: 'from-blue-500 to-indigo-600', order: 0 });"
];
let subjStates = "// Exam Subjects State\n";
subjStatesToRemove.forEach(state => {
    if (content.includes(state)) {
      subjStates += "  " + state + "\n";
      content = content.replace(state, "");
    }
});
content = content.replace("// Exam Subjects State", "");

// Extracted Subjects JS
let subjFuncs = "";
const subjFuncsToExtract = [
  "const fetchSubjects = async",
  "const handleSaveSubject = async",
  "const handleDeleteSubject = async",
  "const resetSubjectForm = () =>",
  "const openSubjectModal = "
];

subjFuncsToExtract.forEach(funcPrefix => {
    let idx = content.indexOf(funcPrefix);
    if (idx !== -1) {
        let funcOpenCount = 0;
        let funcEndIndex = -1;
        let foundBrace = false;
        for (let i = idx; i < content.length; i++) {
            if (content[i] === '{') {
                funcOpenCount++;
                foundBrace = true;
            } else if (content[i] === '}') {
                funcOpenCount--;
                if (foundBrace && funcOpenCount === 0) {
                    if (content[i+1] === ';') funcEndIndex = i + 2;
                    else funcEndIndex = i + 1;
                    break;
                }
            }
        }
        if (funcEndIndex !== -1) {
            let funcCode = content.substring(idx, funcEndIndex);
            subjFuncs += "\n  " + funcCode + "\n";
            content = content.replace(funcCode, `// extracted ${funcPrefix.trim()}`);
        }
    }
});

let innerSubjJSX = subjJSX;
if (innerSubjJSX) {
    const firstParen = innerSubjJSX.indexOf('(');
    const lastParen = innerSubjJSX.lastIndexOf(')');
    if (firstParen !== -1 && lastParen !== -1) {
        innerSubjJSX = innerSubjJSX.substring(firstParen + 1, lastParen);
    }
}

// Subject Component
let subjectCode = `import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { listAdminSubjects, upsertAdminSubject, deleteAdminSubject } from '../../services/adminExamApi';

const ICONS = [
  'folder', 'calculate', 'experiment', 'science', 'biotech', 'menu_book', 'language', 'history_edu', 'public', 'gavel', 'computer', 'functions', 'code', 'architecture', 'trending_up'
];

const COLORS = [
  { value: 'from-blue-500 to-indigo-600', label: 'Lam - Chàm' },
  { value: 'from-amber-500 to-orange-600', label: 'Hổ phách - Cam' },
  { value: 'from-green-500 to-emerald-600', label: 'Lục - Ngọc bích' },
  { value: 'from-teal-500 to-cyan-600', label: 'Mòng két - Lục lam' },
  { value: 'from-rose-500 to-pink-600', label: 'Hồng - Hoa đào' },
  { value: 'from-purple-500 to-violet-600', label: 'Tím - Tử đinh hương' },
  { value: 'from-slate-500 to-gray-600', label: 'Xám - Kẽm' },
];

export default function AdminSubjects({ isActive }) {
${subjStates}

  useEffect(() => {
    if (isActive) fetchSubjects();
  }, [isActive]);
${subjFuncs}

  if (!isActive) return null;

  return (
    <>
      ${innerSubjJSX}
    </>
  );
}
`;


// ==== 2. EXTRACT AdminExams ====
const examStartToken = "{mainTab === 'exams' && (";
const examStartIndex = content.indexOf(examStartToken);
let examJSX = "";

if (examStartIndex !== -1) {
    let openCount = 0;
    let examEndIndex = -1;
    for (let i = examStartIndex + examStartToken.length - 1; i < content.length; i++) {
        if (content[i] === '(') openCount++;
        else if (content[i] === ')') {
            openCount--;
            if (openCount === 0 && content[i+1] === '}') {
                examEndIndex = i + 2; break;
            }
        }
    }
    if (examEndIndex !== -1) {
        examJSX = content.substring(examStartIndex, examEndIndex);
        content = content.replace(examJSX, "{mainTab === 'exams' && <AdminExams isActive={mainTab === 'exams'} />}");
    }
}

// Extract Exams States
const examStatesToRemove = [
  "const [exams, setExams] = useState([]);",
  "const [loadingExams, setLoadingExams] = useState(false);",
  "const [selectedSubject, setSelectedSubject] = useState('ALL');",
  "const [examSearch, setExamSearch] = useState('');",
  "const [editingExam, setEditingExam] = useState(null);",
  "const [examEditForm, setExamEditForm] = useState(DEFAULT_EXAM_EDIT_FORM);",
  "const [selectedAnswerFile, setSelectedAnswerFile] = useState(null);",
  "const [selectedExamFile, setSelectedExamFile] = useState(null);",
  "const [savingExam, setSavingExam] = useState(false);",
  "const [keysError, setKeysError] = useState(null);",
  "const [examsDbError, setExamsDbError] = useState(null);"
];
let examStates = "// Exam Form State\n";
examStatesToRemove.forEach(state => {
    if (content.includes(state)) {
      examStates += "  " + state + "\n";
      content = content.replace(state, "");
    }
});
content = content.replace("// Exam Management State", "");

// Extracted Exams JS
let examFuncs = "";
const examFuncsToExtract = [
  "const fetchExams = async",
  "const deleteExam = async",
  "const toggleExamKeyVisibility = async",
  "const handleStartEdit = async",
  "const handleSyncFromJson = async",
  "const handleSaveEdit = async",
  "const handleCancelEdit = () =>"
];

examFuncsToExtract.forEach(funcPrefix => {
    let idx = content.indexOf(funcPrefix);
    if (idx !== -1) {
        let funcOpenCount = 0;
        let funcEndIndex = -1;
        let foundBrace = false;
        for (let i = idx; i < content.length; i++) {
            if (content[i] === '{') {
                funcOpenCount++;
                foundBrace = true;
            } else if (content[i] === '}') {
                funcOpenCount--;
                if (foundBrace && funcOpenCount === 0) {
                    if (content[i+1] === ';') funcEndIndex = i + 2;
                    else funcEndIndex = i + 1;
                    break;
                }
            }
        }
        if (funcEndIndex !== -1) {
            let funcCode = content.substring(idx, funcEndIndex);
            examFuncs += "\n  " + funcCode + "\n";
            content = content.replace(funcCode, `// extracted ${funcPrefix.trim()}`);
        }
    }
});

let innerExamJSX = examJSX;
if (innerExamJSX) {
    const firstParen = innerExamJSX.indexOf('(');
    const lastParen = innerExamJSX.lastIndexOf(')');
    if (firstParen !== -1 && lastParen !== -1) {
        innerExamJSX = innerExamJSX.substring(firstParen + 1, lastParen);
    }
}

// Notice that fetchExams depends on examSubjects which we just moved. 
// However, AdminExams needs to list subjects in the select box.
// So AdminExams must fetch its own subjects or import 'listAdminSubjects'!
// It's much cleaner for AdminExams to have its own subjects state.
// We will insert 'examSubjects' state to AdminExams, or fetch them locally inside AdminExams!

// AdminExams Component
let examCode = `import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  deleteAdminExamKeys,
  getAdminExamKey,
  hasPopulatedAnswerKey,
  listAdminExamKeys,
  normalizeExamResources,
  upsertAdminExamKeyBundle,
  uploadExamAnswerFile,
  uploadExamDocumentFile,
  listAdminSubjects
} from '../../services/adminExamApi';

const DEFAULT_EXAM_EDIT_FORM = {
  title: '', subject_folder: '', exam_path: '', time: '', questions: '', status: 'ongoing', answer_key: '{}',
  folder_url: '', lecture_url: '', document_url: '', answer_file_url: '',
};

const EXAM_STATUS_OPTIONS = [
  { value: 'ongoing', label: 'Đang mở' },
  { value: 'upcoming', label: 'Sắp mở' },
  { value: 'ended', label: 'Đã đóng' },
];

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');
const toOptionalPositiveInteger = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
};
const countQuestionsFromExamJson = (examJson) => {
  if (!Array.isArray(examJson?.parts)) return 0;
  return examJson.parts.reduce((total, part) => (
    total + (Array.isArray(part?.questions) ? part.questions.length : 0)
  ), 0);
};

export default function AdminExams({ isActive }) {
${examStates}
  const [examSubjects, setExamSubjects] = useState([]);
  const answerFileInputRef = useRef(null);
  const examFileInputRef = useRef(null);

  useEffect(() => {
    if (isActive) {
      loadInitialData();
    }
  }, [isActive]);

  const loadInitialData = async () => {
    try {
        const subjects = await listAdminSubjects();
        setExamSubjects(subjects);
        await fetchExams(subjects);
    } catch(err) {
        console.error(err);
    }
  };

  // We are rewriting fetchExams slightly so it uses passed subjects or falls back to state
  const fetchExams = async (fetchedSubjects = examSubjects) => {
    setLoadingExams(true);
    setExamsDbError(null);
    setKeysError(null);

    try {
      const dbExams = await listAdminExamKeys();
      const unifiedExams = normalizeExamResources([], dbExams, fetchedSubjects);
      setExams(unifiedExams);
    } catch (error) {
      console.error('Error fetching exams:', error);
      setExamsDbError(error.message);
    } finally {
      setLoadingExams(false);
    }
  };

${examFuncs.replace(/await fetchExams\(\)/g, "await fetchExams()").replace(/const fetchExams = async/g, "const _oldFetchExams = async")}

  if (!isActive) return null;

  return (
    <>
      ${innerExamJSX}
    </>
  );
}
`;


// ==== Clean up Admin.jsx
content = content.replace("useEffect(() => {\n    if (!isAdmin) return;", "useEffect(() => {\n    if (!isAdmin) return;\n    if (mainTab === 'vip') { fetchPaymentLogs(); fetchVipMembers(); }\n  }, [isAdmin, mainTab]);\n  // old \n/* ");
content = content.replace("  // Security Check: Kick out non-admins", "*/ // Security Check: Kick out non-admins");

// Remove useEffects parts for subject/exam
content = content.replace("} else if (mainTab === 'exams') {\n      fetchExams();\n      fetchSubjects();\n    } else if (mainTab === 'subjects') {\n      fetchSubjects();\n    }", "");

// Add imports
if (!content.includes("import AdminSubjects")) {
    content = content.replace("import AdminLibrary from '../components/admin/AdminLibrary';", "import AdminLibrary from '../components/admin/AdminLibrary';\nimport AdminSubjects from '../components/admin/AdminSubjects';\nimport AdminExams from '../components/admin/AdminExams';");
}

fs.writeFileSync(adminPath, content, 'utf8');
fs.writeFileSync(path.join(__dirname, 'src', 'components', 'admin', 'AdminSubjects.jsx'), subjectCode, 'utf8');
fs.writeFileSync(path.join(__dirname, 'src', 'components', 'admin', 'AdminExams.jsx'), examCode, 'utf8');

console.log("AdminExams & AdminSubjects extraction complete.");
