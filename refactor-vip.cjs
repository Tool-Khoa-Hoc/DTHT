const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, 'src', 'pages', 'Admin.jsx');
let content = fs.readFileSync(adminPath, 'utf8');

// 1. Add import
if (!content.includes("import AdminVip")) {
    content = content.replace("import Avatar from '../components/Avatar';", "import Avatar from '../components/Avatar';\nimport AdminVip from '../components/admin/AdminVip';");
}

// 2. Remove states
const statesToRemove = [
  "const [vipSearch, setVipSearch] = useState('');",
  "const [vipGrantEmail, setVipGrantEmail] = useState('');",
  "const [vipGrantDays, setVipGrantDays] = useState(30);",
  "const [vipUsers, setVipUsers] = useState([]);",
  "const [vipLoading, setVipLoading] = useState(false);",
  "const [vipGrantLoading, setVipGrantLoading] = useState(false);",
  "const [paymentLogs, setPaymentLogs] = useState([]);",
  "const [paymentLogsLoading, setPaymentLogsLoading] = useState(false);",
  "const [vipMsg, setVipMsg] = useState({ type: '', text: '' });",
  "const [vipMembers, setVipMembers] = useState([]);",
  "const [vipMembersLoading, setVipMembersLoading] = useState(false);"
];
statesToRemove.forEach(state => {
    content = content.replace(state, "");
});
content = content.replace("// VIP Management State", "");

// 3. Remove useEffect calls
content = content.replace(
    "    } else if (mainTab === 'vip') {\n      fetchPaymentLogs();\n      fetchVipMembers();\n    }",
    "    } else if (mainTab === 'vip') {\n      // Handled by AdminVip\n    }"
);

// 4. Remove VIP functions (regex replace)
// We need to be careful with functions.
// We can use a regex to match from "const searchVipUsers = async" to the end of "const fetchVipMembers = async () => {...}"
// Actually, it's safer to just let the unused functions remain for a moment and only replace JSX, or remove them specifically.

// 5. Replace JSX
// The JSX starts with "{mainTab === 'vip' && (" or similar.
// It ends somewhere. Let's just find "const showVipMessage"
// We'll write the modified content back.
fs.writeFileSync(adminPath, content, 'utf8');
console.log("Replaced states and imports.");
