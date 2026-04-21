const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, 'src', 'pages', 'Admin.jsx');
let content = fs.readFileSync(adminPath, 'utf8');

const startIndex = content.indexOf("{mainTab === 'vip' && (");
if (startIndex !== -1) {
    let bracketCount = 0;
    let foundStart = false;
    let endIndex = -1;

    for (let i = startIndex + "{mainTab === 'vip' && (".length; i < content.length; i++) {
        if (content[i] === '(') {
            bracketCount++;
            foundStart = true;
        } else if (content[i] === ')') {
            if (bracketCount === 0 && foundStart) {
                endIndex = i;
                break;
            }
            bracketCount--;
        } else {
            if (!foundStart && content.substring(i, i+1).trim() !== '') {
                foundStart = true;
                if (content[i] === '(') bracketCount++;
            }
        }
    }
    
    // Fallback naive search if it's `{mainTab === 'vip' && <AdminVip ... />}`
    const exactEnd = content.indexOf("          {/* --- ADMIN THÔNG SOÁI TAB --- */}");
    const exactStart = content.indexOf("{mainTab === 'vip' && (");
    
    if (exactStart !== -1 && exactEnd !== -1) {
       console.log("Found VIP JSX block via comments.");
       const block = content.substring(exactStart, exactEnd);
       content = content.replace(block, "{mainTab === 'vip' && <AdminVip isActive={true} />}\n\n");
       fs.writeFileSync(adminPath, content, 'utf8');
       console.log("JSX replaced successfully via substring.");
    } else {
       console.log("Start:", exactStart, "End:", exactEnd);
    }
} else {
    console.log("Could not find {mainTab === 'vip' && (");
}
