import React, { useMemo } from 'react';

const CHOICE_LABELS = ['A', 'B', 'C', 'D'];
const TRUE_FALSE_LABELS = ['a', 'b', 'c', 'd'];

function range(start, end) {
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default function AnswerSheet2025({ examData, answers, handleAnswerChange, readOnly = false }) {
    
    // Split parts based on 'single_choice', 'true_false', 'short_answer'
    const part1 = examData?.parts?.find(p => p.questions.some(q => q.type === 'single_choice'));
    const part2 = examData?.parts?.find(p => p.questions.some(q => q.type === 'true_false'));
    const part3 = examData?.parts?.find(p => p.questions.some(q => q.type === 'short_answer'));

    const getQuestionKey = (partId, questionId) => `${partId}.${questionId}`;

    return (
        <div className="bg-[#fcecf0] min-h-full p-4 md:p-8 font-sans select-none relative overflow-x-hidden">
            <style dangerouslySetInnerHTML={{__html: `
                .bubble {
                    width: 26px;
                    height: 26px;
                    flex-shrink: 0;
                    border: 1.5px solid #ef4444;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 13px;
                    font-weight: 600;
                    color: #ef4444;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    background: white;
                }
                .bubble:hover {
                    background: #fee2e2;
                }
                .bubble.filled {
                    background: #dc2626 !important;
                    border-color: #dc2626;
                    color: white;
                }
            `}} />

            <div className="max-w-4xl mx-auto space-y-10 pb-20">
                
                {/* PHẦN 1 */}
                {part1 && (
                    <div className="mb-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-4 h-5 bg-red-600 rounded-sm"></div>
                            <h2 className="text-xl font-bold font-sans text-red-700 tracking-wider">PHẦN I</h2>
                        </div>
                        
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 md:gap-6">
                            {/* Group into columns of 10 for layout identical to paper */}
                            {Array.from({ length: Math.ceil(part1.questions.length / 10) }).map((_, colIndex) => {
                                const columnQuestions = part1.questions.slice(colIndex * 10, (colIndex + 1) * 10);
                                return (
                                    <div key={`col-${colIndex}`} className="border-2 border-red-500 bg-white p-3 md:p-4 rounded-xl shadow-[0_2px_10px_rgba(239,68,68,0.1)] flex flex-col gap-2 relative">
                                        {/* Reference letters row */}
                                        <div className="flex pl-[28px] gap-[12px] mb-2 text-red-500 font-bold text-xs uppercase opacity-80">
                                            <div className="w-[26px] text-center">A</div>
                                            <div className="w-[26px] text-center">B</div>
                                            <div className="w-[26px] text-center">C</div>
                                            <div className="w-[26px] text-center">D</div>
                                        </div>

                                        {columnQuestions.map((q, idx) => {
                                            const questionNumber = colIndex * 10 + idx + 1;
                                            const questionKey = getQuestionKey(part1.id, q.id);
                                            const currentAns = answers[questionKey];

                                            return (
                                                <div key={questionKey} className="flex items-center gap-[12px]">
                                                    <div className="w-5 text-right font-bold text-slate-700 text-sm">{questionNumber}</div>
                                                    {CHOICE_LABELS.map((label, optIdx) => (
                                                        <div 
                                                            key={label}
                                                            onClick={() => !readOnly && handleAnswerChange(questionKey, optIdx)}
                                                            className={`bubble ${currentAns === optIdx ? 'filled' : ''}`}
                                                        >
                                                            {currentAns === optIdx ? '' : ''}
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* PHẦN 2 */}
                {part2 && (
                    <div className="mb-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-4 h-5 bg-red-600 rounded-sm"></div>
                            <h2 className="text-xl font-bold font-sans text-red-700 tracking-wider">PHẦN II</h2>
                        </div>
                        
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 md:gap-6">
                            {/* Each question has 4 statements */}
                            {part2.questions.map((q, qIdx) => {
                                const questionKey = getQuestionKey(part2.id, q.id);
                                return (
                                    <div key={questionKey} className="border-2 border-red-500 bg-white p-4 rounded-xl shadow-[0_2px_10px_rgba(239,68,68,0.1)] flex flex-col">
                                        <div className="text-center font-bold text-slate-800 mb-3 border-b border-red-200 pb-2">Câu {qIdx + 1}</div>
                                        <div className="flex justify-between px-8 text-red-500 font-bold text-[11px] uppercase mb-3">
                                            <span>Đúng</span>
                                            <span>Sai</span>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            {TRUE_FALSE_LABELS.map((stmtLabel, stmtIdx) => {
                                                const stmt = q.statements?.[stmtIdx];
                                                if (!stmt) return null;
                                                const currentAns = answers[questionKey]?.[stmt.id];

                                                return (
                                                    <div key={stmt.id} className="flex items-center justify-between px-2">
                                                        <div className="font-bold text-sm text-slate-700 w-5">{stmtLabel})</div>
                                                        <div className="flex gap-[36px]">
                                                            <div 
                                                                onClick={() => !readOnly && handleAnswerChange(questionKey, true, stmt.id)}
                                                                className={`bubble ${currentAns === true ? 'filled' : ''}`}
                                                            >Đ</div>
                                                            <div 
                                                                onClick={() => !readOnly && handleAnswerChange(questionKey, false, stmt.id)}
                                                                className={`bubble ${currentAns === false ? 'filled' : ''}`}
                                                            >S</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* PHẦN 3 */}
                {part3 && (
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-4 h-5 bg-red-600 rounded-sm"></div>
                            <h2 className="text-xl font-bold font-sans text-red-700 tracking-wider">PHẦN III</h2>
                        </div>
                        
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4 md:gap-6">
                            {part3.questions.map((q, qIdx) => {
                                const questionKey = getQuestionKey(part3.id, q.id);
                                const rawValue = (answers[questionKey] || '');
                                // Clean value to only allow symbols '-', ',' and digits
                                const sanitizedValue = rawValue.replace(/[^0-9,\-]/g, '').slice(0, 4); 

                                const handleInputChange = (e) => {
                                    if(readOnly) return;
                                    let val = e.target.value;
                                    val = val.replace('.', ',');
                                    handleAnswerChange(questionKey, val);
                                };

                                return (
                                    <div key={questionKey} className="border-2 border-red-500 bg-white rounded-xl shadow-[0_2px_10px_rgba(239,68,68,0.1)] flex flex-col relative overflow-hidden">
                                        <div className="bg-red-50 text-center font-bold text-slate-800 py-2 border-b-2 border-red-500 text-sm">Câu {qIdx + 1}</div>
                                        
                                        <div className="p-3">
                                            {/* Input box to type value directly */}
                                            <input 
                                                disabled={readOnly}
                                                type="text" 
                                                value={rawValue}
                                                onChange={handleInputChange}
                                                placeholder="VD: -4,5"
                                                className="w-full text-center font-bold text-[22px] mb-4 p-2 bg-slate-50 border-b-2 border-slate-300 focus:outline-none focus:border-red-500 transition-colors uppercase tracking-[0.2em] text-red-600 rounded-sm"
                                                autoComplete="off"
                                                maxLength={5}
                                            />

                                            {/* Smart visual bubble indicator automatically filled by what user types */}
                                            <div className="flex justify-center gap-2 opacity-80 pointer-events-none scale-[0.85] origin-top">
                                                 {Array.from({length: 4}).map((_, colIdx) => {
                                                    const charAtCol = sanitizedValue[colIdx] || '';
                                                    return (
                                                        <div key={colIdx} className="flex flex-col gap-[6px] items-center">
                                                            {/* Minus symbol row */}
                                                            <div className={`w-[22px] h-[22px] flex-shrink-0 border-[1.5px] border-red-500 rounded-full flex items-center justify-center text-[12px] font-bold text-red-500 ${charAtCol === '-' ? 'bg-red-600 border-red-600 text-white' : ''}`}>-</div>
                                                            {/* Comma symbol row */}
                                                            <div className={`w-[22px] h-[22px] flex-shrink-0 border-[1.5px] border-red-500 rounded-full flex items-center justify-center text-[12px] font-bold text-red-500 ${charAtCol === ',' ? 'bg-red-600 border-red-600 text-white' : ''}`}>,</div>
                                                            
                                                            {/* Number rows 0-9 */}
                                                            {range(0, 9).map((num) => (
                                                                <div key={num} className={`w-[22px] h-[22px] flex-shrink-0 border-[1.5px] border-red-500 rounded-full flex items-center justify-center text-[11px] font-bold text-red-500 ${charAtCol === String(num) ? 'bg-red-600 border-red-600 text-transparent' : ''}`}>
                                                                    {num}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )
                                                 })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
