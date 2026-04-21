const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, 'src', 'pages', 'Admin.jsx');
let content = fs.readFileSync(adminPath, 'utf8');

const libStartToken = "{mainTab === 'library' && (";
const libStartIndex = content.indexOf(libStartToken);
let libJSX = "";
let newAdminContent = content;

if (libStartIndex !== -1) {
    let openCount = 0;
    let libEndIndex = -1;
    for (let i = libStartIndex + libStartToken.length - 1; i < content.length; i++) {
        if (content[i] === '(') openCount++;
        else if (content[i] === ')') {
            openCount--;
            if (openCount === 0 && content[i+1] === '}') {
                libEndIndex = i + 2; break;
            }
        }
    }
    if (libEndIndex !== -1) {
        libJSX = content.substring(libStartIndex, libEndIndex);
        newAdminContent = newAdminContent.replace(libJSX, "{mainTab === 'library' && <AdminLibrary isActive={mainTab === 'library'} />}");
    }
}

// Add import
if (!newAdminContent.includes("import AdminLibrary")) {
    newAdminContent = newAdminContent.replace("import AdminCollaborator from '../components/admin/AdminCollaborator';", "import AdminCollaborator from '../components/admin/AdminCollaborator';\nimport AdminLibrary from '../components/admin/AdminLibrary';");
}

const statesToRemove = [
  "const [docId, setDocId] = useState(null);",
  "const [title, setTitle] = useState('');",
  "const [description, setDescription] = useState('');",
  "const [publishDate, setPublishDate] = useState('');",
  "const [fileUrl, setFileUrl] = useState('');",
  "const [authorName, setAuthorName] = useState('');",
  "const [major, setMajor] = useState('');",
  "const [category, setCategory] = useState('khac');",
  "const [isFeatured, setIsFeatured] = useState(false);",
  "const [educationLevel, setEducationLevel] = useState('thpt');",
  "const [loading, setLoading] = useState(false);",
  "const [message, setMessage] = useState({ type: '', text: '' });",
  "const [documents, setDocuments] = useState([]);",
  "const [loadingDocs, setLoadingDocs] = useState(true);"
];

let extractedStates = "// Library Form State\n";
statesToRemove.forEach(state => {
    if (content.includes(state)) {
      extractedStates += "  " + state + "\n";
      newAdminContent = newAdminContent.replace(state, "");
    }
});
newAdminContent = newAdminContent.replace("// Library Form State", "");
newAdminContent = newAdminContent.replace("// List State", "");

// remove single lingering setter calls 
newAdminContent = newAdminContent.replace(/setDocId\(null\);/g, "");

newAdminContent = newAdminContent.replace(
    "if (mainTab === 'library') {\n      fetchDocuments();\n    } else",
    "if (mainTab === 'library') {\n      // Handled by AdminLibrary\n    } else"
);

const functionsToExtract = [
  "const fetchDocuments = async",
  "const handleLibrarySubmit = async",
  "const handleDelete = async",
  "const toggleFeatured = async",
  "const handleEdit = (doc) =>",
  "const resetForm = () =>",
  "const handleClearReports = async"
];

let extractedFunctions = "";

functionsToExtract.forEach(funcPrefix => {
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
            extractedFunctions += "\n  " + funcCode + "\n";
            newAdminContent = newAdminContent.replace(funcCode, `// extracted ${funcPrefix.trim()}`);
        }
    }
});

let innerJSX = libJSX;
if (innerJSX) {
    const firstParen = innerJSX.indexOf('(');
    const lastParen = innerJSX.lastIndexOf(')');
    if (firstParen !== -1 && lastParen !== -1) {
        innerJSX = innerJSX.substring(firstParen + 1, lastParen);
    }
}

fs.writeFileSync(adminPath, newAdminContent, 'utf8');

let adminLibraryCode = `import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { assertSafeExternalUrl } from '../../utils/urlSecurity';

const CATEGORIES = [
  { label: 'Toán', value: 'toan', icon: 'calculate', color: 'from-blue-500 to-indigo-600' },
  { label: 'Vật Lý', value: 'ly', icon: 'experiment', color: 'from-amber-500 to-orange-600' },
  { label: 'Hóa Học', value: 'hoa', icon: 'science', color: 'from-green-500 to-emerald-600' },
  { label: 'Sinh Học', value: 'sinh', icon: 'biotech', color: 'from-teal-500 to-cyan-600' },
  { label: 'Ngữ Văn', value: 'van', icon: 'menu_book', color: 'from-rose-500 to-pink-600' },
  { label: 'Tiếng Anh', value: 'anh', icon: 'language', color: 'from-sky-500 to-blue-600' },
  { label: 'Lịch Sử', value: 'su', icon: 'history_edu', color: 'from-yellow-600 to-amber-700' },
  { label: 'Địa Lý', value: 'dia', icon: 'public', color: 'from-lime-500 to-green-600' },
  { label: 'GDCD', value: 'gdcd', icon: 'gavel', color: 'from-purple-500 to-violet-600' },
  { label: 'Tin Học', value: 'tin', icon: 'computer', color: 'from-cyan-500 to-sky-600' },
  { label: 'Giải Tích', value: 'giai_tich', icon: 'functions', color: 'from-indigo-500 to-purple-600' },
  { label: 'Lập Trình', value: 'lap_trinh', icon: 'code', color: 'from-slate-500 to-gray-600' },
  { label: 'Kiến Trúc', value: 'kien_truc', icon: 'architecture', color: 'from-orange-500 to-red-500' },
  { label: 'Kinh Tế', value: 'kinh_te', icon: 'trending_up', color: 'from-emerald-500 to-teal-600' },
  { label: 'Khác', value: 'khac', icon: 'folder', color: 'from-gray-400 to-slate-500' },
];

export default function AdminLibrary({ isActive }) {
  const { user } = useAuth();
${extractedStates}

  useEffect(() => {
    if (isActive) {
      fetchDocuments();
    }
  }, [isActive]);
${extractedFunctions}

  if (!isActive) return null;

  return (
    <>
      ${innerJSX}
    </>
  );
}
`;

fs.writeFileSync(path.join(__dirname, 'src', 'components', 'admin', 'AdminLibrary.jsx'), adminLibraryCode, 'utf8');
console.log("AdminLibrary extraction complete.");
