const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, 'src', 'pages', 'Admin.jsx');
let content = fs.readFileSync(adminPath, 'utf8');

// 1. Add imports
if (!content.includes("import AdminThongSoai")) {
    content = content.replace("import AdminVip from '../components/admin/AdminVip';", "import AdminVip from '../components/admin/AdminVip';\nimport AdminThongSoai from '../components/admin/AdminThongSoai';\nimport AdminCollaborator from '../components/admin/AdminCollaborator';");
}

// 2. Remove states
const statesToRemove = [
  "const [candidates, setCandidates] = useState([]);",
  "const [loadingCandidates, setLoadingCandidates] = useState(false);",
  "const [collabSearchTerm, setCollabSearchTerm] = useState('');",
  "const [searchResults, setSearchResults] = useState([]);",
  "const [collaborators, setCollaborators] = useState([]);",
  "const [loadingCollabs, setLoadingCollabs] = useState(false);"
];
statesToRemove.forEach(state => {
    content = content.replace(state, "");
});
content = content.replace("// Thống Soái State", "");
content = content.replace("// Collaborator State", "");

// 3. Remove useEffect parts
content = content.replace(
    "} else if (mainTab === 'thongsoai') {\n      fetchCandidates();",
    "} else if (mainTab === 'thongsoai') {\n      // Handled by AdminThongSoai"
);
content = content.replace(
    "} else if (mainTab === 'collaborators') {\n      fetchCollaborators();",
    "} else if (mainTab === 'collaborators') {\n      // Handled by AdminCollaborator"
);

// 4. Remove JSX & functions
// Thống Soái JSX
const tsStartToken = "{mainTab === 'thongsoai' && (";
const tsStartIndex = content.indexOf(tsStartToken);
if (tsStartIndex !== -1) {
    let openCount = 0;
    let tsEndIndex = -1;
    for (let i = tsStartIndex + tsStartToken.length - 1; i < content.length; i++) {
        if (content[i] === '(') openCount++;
        else if (content[i] === ')') {
            openCount--;
            if (openCount === 0 && content[i+1] === '}') {
                tsEndIndex = i + 2; break;
            }
        }
    }
    if (tsEndIndex !== -1) {
        content = content.replace(content.substring(tsStartIndex, tsEndIndex), "{mainTab === 'thongsoai' && <AdminThongSoai isActive={true} />}");
    }
}

// Collaborator JSX
const collabStartToken = "{mainTab === 'collaborators' && (";
const collabStartIndex = content.indexOf(collabStartToken);
if (collabStartIndex !== -1) {
    let openCount = 0;
    let collabEndIndex = -1;
    for (let i = collabStartIndex + collabStartToken.length - 1; i < content.length; i++) {
        if (content[i] === '(') openCount++;
        else if (content[i] === ')') {
            openCount--;
            if (openCount === 0 && content[i+1] === '}') {
                collabEndIndex = i + 2; break;
            }
        }
    }
    if (collabEndIndex !== -1) {
        content = content.replace(content.substring(collabStartIndex, collabEndIndex), "{mainTab === 'collaborators' && <AdminCollaborator isActive={true} />}");
    }
}

// Extract Functions (Regex or substring check)
const functionsToRemove = [
  "const fetchCandidates = async",
  "const approveBangChu = async",
  "const fetchCollaborators = async",
  "const searchUsers = async",
  "const setCollaboratorRole = async"
];
functionsToRemove.forEach(funcPrefix => {
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
            content = content.replace(content.substring(idx, funcEndIndex), `// extracted ${funcPrefix.trim()}`);
        }
    }
});

fs.writeFileSync(adminPath, content, 'utf8');
console.log("Refactoring of AdminThongSoai and AdminCollaborator complete.");
