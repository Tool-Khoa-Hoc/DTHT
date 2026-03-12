import fs from 'fs/promises';
import path from 'path';

const EXAMS_DIR = path.join(process.cwd(), 'public', 'data', 'exams');
const OUTPUT_FILE = path.join(EXAMS_DIR, 'index.json');

async function buildIndex() {
    try {
        const indexData = [];
        const items = await fs.readdir(EXAMS_DIR, { withFileTypes: true });

        for (const item of items) {
            if (item.isDirectory()) {
                const subjectFolder = item.name;
                const subjectPath = path.join(EXAMS_DIR, subjectFolder);
                const examFiles = await fs.readdir(subjectPath);

                for (const file of examFiles) {
                    if (file.endsWith('.json')) {
                        const filePath = path.join(subjectPath, file);
                        const fileContent = await fs.readFile(filePath, 'utf-8');
                        try {
                            const json = JSON.parse(fileContent);
                            
                            // Calculate total questions dynamically if not provided
                            let qCount = 0;
                            if (json.parts) {
                                qCount = json.parts.reduce((sum, part) => sum + (part.questions?.length || 0), 0);
                            }

                            // We map UI specific details like color and icon based on subject
                            let icon = 'quiz';
                            let color = 'from-slate-500 to-slate-600';
                            
                            if (json.subject.toLowerCase().includes('toán')) {
                                icon = 'functions'; color = 'from-blue-500 to-indigo-600';
                            } else if (json.subject.toLowerCase().includes('lý')) {
                                icon = 'architecture'; color = 'from-emerald-500 to-teal-600';
                            } else if (json.subject.toLowerCase().includes('anh')) {
                                icon = 'language'; color = 'from-rose-500 to-pink-600';
                            } else if (json.subject.toLowerCase().includes('hóa')) {
                                icon = 'science'; color = 'from-amber-500 to-orange-600';
                            } else if (json.subject.toLowerCase().includes('sinh')) {
                                icon = 'biotech'; color = 'from-green-500 to-lime-600';
                            }

                            indexData.push({
                                id: json.id,
                                title: json.title,
                                subject: json.subject,
                                subjectFolder: subjectFolder, // crucial for routing
                                time: json.time,
                                questions: qCount,
                                participants: Math.floor(Math.random() * 2000) + 100, // mock data for now
                                status: "ongoing", // or derive from some property
                                color: color,
                                icon: icon
                            });
                        } catch (e) {
                            console.error(`Error parsing ${file}:`, e.message);
                        }
                    }
                }
            }
        }

        await fs.writeFile(OUTPUT_FILE, JSON.stringify(indexData, null, 2));
        console.log(`Successfully built exam index with ${indexData.length} exams.`);
    } catch (err) {
        console.error("Failed to build index:", err);
    }
}

buildIndex();
