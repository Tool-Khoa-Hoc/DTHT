const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, 'src', 'pages', 'Admin.jsx');
let content = fs.readFileSync(adminPath, 'utf8');

const startStr = "{mainTab === 'vip' && (";
const startIndex = content.indexOf(startStr);
if (startIndex !== -1) {
    // Find the matching closing parenthesis and brace
    let openCount = 0;
    let endIndex = -1;
    // start parsing after the opening parenthesis
    for (let i = startIndex + startStr.length - 1; i < content.length; i++) {
        if (content[i] === '(') openCount++;
        else if (content[i] === ')') {
            openCount--;
            if (openCount === 0 && content[i+1] === '}') {
                endIndex = i + 2;
                break;
            }
        }
    }
    
    if (endIndex !== -1) {
       console.log("Found VIP JSX block. Replacing...");
       const block = content.substring(startIndex, endIndex);
       content = content.replace(block, "{mainTab === 'vip' && <AdminVip isActive={true} />}");
       
       // remove VIP functions
       const functionsToRemove = [
          "const showVipMessage = ",
          "const searchVipUsers = ",
          "const extendVipMembership = ",
          "const addVipDays = ",
          "const toggleVip = ",
          "const grantVipByEmail = ",
          "const fetchPaymentLogs = ",
          "const fetchVipMembers = "
       ];
       
       functionsToRemove.forEach(funcPrefix => {
           let idx = content.indexOf(funcPrefix);
           if (idx !== -1) {
               // find corresponding end of function
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
                           // check if it's the end of an async arrow function, it has a semicolon sometimes
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
       console.log("Done.");
    } else {
       console.log("Could not find end of VIP JSX");
    }
} else {
    console.log("Could not find start form");
}
