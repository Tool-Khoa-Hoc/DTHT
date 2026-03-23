import fs from 'fs';
let c = fs.readFileSync('src/pages/UserProfile.jsx', 'utf8');

const rankSnippet = `
                    {/* Rank Progress Bar */}
                    {rankInfo?.progress && !rankInfo?.isMax && (
                        <div className={\`w-full max-w-[200px] mx-auto mb-5 relative z-10 \${rankInfo.color}\`}>
                            <div className="flex justify-between items-end mb-1.5 opacity-80">
                                <span className="text-[10px] font-bold tracking-wider uppercase">Lên {rankInfo.nextRank.name}</span>
                                <span className="text-xs font-black">{rankInfo.progress.current} / {rankInfo.progress.target}</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full overflow-hidden bg-white/5 border border-white/10">
                                <div
                                    className="h-full bg-current transition-all duration-1000 ease-out rounded-full shadow-[0_0_10px_currentColor]"
                                    style={{ width: \`\${rankInfo.progress.percentage}%\` }}
                                ></div>
                            </div>
                        </div>
                    )}`;

c = c.replace(
    /{profile\.role === 'collaborator' && \([\s\S]*?<\/div>/,
    match => match + '\n' + rankSnippet
);

c = c.replace(
    /<span>\{camp\.targets\.filter\(t => t\.is_completed\)\.length\} \/ \{camp\.targets\.length\}<\/span>/g,
    '<span>{camp.is_completed ? camp.targets.length : camp.targets.filter(t => t.is_completed).length} / {camp.targets.length}</span>'
);

c = c.replace(
    /style=\{\{ width: `\$\{\(camp\.targets\.filter\(t => t\.is_completed\)\.length \/ camp\.targets\.length\) \* 100\}%` \}\}/g,
    'style={{ width: `${camp.is_completed ? 100 : (camp.targets.filter(t => t.is_completed).length / camp.targets.length) * 100}%` }}'
);

fs.writeFileSync('src/pages/UserProfile.jsx', c);
console.log('Fixed UserProfile.jsx successfully');
