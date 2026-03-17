const fs = require('fs');
const file = 'd:/Web sv/tram_hs_sv/src/pages/ExamRoom.jsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

const newContent = `                        const displayTitle = examMeta.title.replace(/TSA/gi, examMeta.subject ? \\\`\\\${examMeta.subject.toUpperCase()} THPT\\\` : 'THPT');
                        const displayBadge = examMeta.subject ? \\\`\\\${examMeta.subject.toUpperCase()} THPT\\\` : 'ĐÁNH GIÁ NĂNG LỰC';
                        const isOngoing = examMeta.status === 'ongoing';
                        const actionText = isOngoing ? 'Bắt đầu thi' : statusMeta.actionLabel;
                        const actionBtnClass = isOngoing 
                            ? 'bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-lg shadow-[#4f46e5]/30' 
                            : statusMeta.actionClass;

                        return (
                        <article
                            key={examMeta.id}
                            className="group relative bg-[#1a0f12]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 transition-all duration-300 hover:shadow-2xl hover:shadow-[#4f46e5]/10 hover:-translate-y-1 overflow-hidden aspect-square min-h-[230px] flex flex-col"
                        >
                            {/* Image Section */}
                            <div className="relative -mx-4 -mt-4 mb-3 shrink-0 h-[45%] overflow-hidden">
                                <img src="/bk.png" alt="Background" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                <div className="absolute top-2 right-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg border border-white/10">
                                    <span className="material-symbols-outlined text-[12px]">crown</span> VIP
                                </div>
                            </div>

                            {/* Content Section */}
                            <div className="flex flex-col flex-1">
                                {/* Badge & Rating */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1 text-[#4f46e5] bg-[#4f46e5]/10 px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold border border-[#4f46e5]/20">
                                        <span className="material-symbols-outlined text-[12px]">description</span>
                                        {displayBadge}
                                    </div>
                                    <div className="flex items-center gap-1 text-amber-400 text-[10px] font-bold">
                                        <span className="material-symbols-outlined text-[12px]">star</span>
                                        4.8
                                    </div>
                                </div>

                                {/* Title */}
                                <h3
                                    className="text-sm md:text-[15px] font-bold text-white leading-snug group-hover:text-[#4f46e5] transition-colors mb-2 line-clamp-2"
                                    title={displayTitle}
                                >
                                    {displayTitle}
                                </h3>

                                {/* Meta Stats */}
                                <div className="flex items-center justify-between bg-white/5 rounded-xl p-2 mb-3 mt-auto border border-white/5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                                            <span className="material-symbols-outlined text-[12px]">help</span>
                                        </div>
                                        <div className="leading-tight">
                                            <div className="text-[9px] text-slate-400">Câu hỏi</div>
                                            <div className="font-bold text-[10px] text-slate-200">{examMeta.questions} câu</div>
                                        </div>
                                    </div>
                                    <div className="w-px h-6 bg-white/10 hidden xl:block"></div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 shrink-0">
                                            <span className="material-symbols-outlined text-[12px]">schedule</span>
                                        </div>
                                        <div className="leading-tight">
                                            <div className="text-[9px] text-slate-400">Thời gian</div>
                                            <div className="font-bold text-[10px] text-slate-200">{typeof examMeta.time === 'number' ? \\\`\\\${examMeta.time} phút\\\` : examMeta.time}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 mt-auto">
                                    {isOngoing && examHref ? (
                                        <Link
                                            to={examHref}
                                            className={\\\`flex-1 h-9 rounded-xl font-bold text-xs transition-all flex items-center justify-center \\\${actionBtnClass}\\\`}
                                        >
                                            {actionText}
                                        </Link>
                                    ) : (
                                        <button
                                            onClick={() => handleJoin(examMeta)}
                                            className={\\\`flex-1 h-9 rounded-xl font-bold text-xs transition-all flex items-center justify-center \\\${actionBtnClass}\\\`}
                                        >
                                            {actionText}
                                        </button>
                                    )}
                                    <button className="w-9 h-9 shrink-0 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 transition-colors border border-white/5">
                                        <span className="material-symbols-outlined text-[14px]">favorite</span>
                                    </button>
                                    <button className="w-9 h-9 shrink-0 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 transition-colors border border-white/5">
                                        <span className="material-symbols-outlined text-[14px]">share</span>
                                    </button>
                                </div>
                            </div>
                        </article>
                        );`;
lines.splice(143, 61, newContent);
fs.writeFileSync(file, lines.join('\n'));
console.log('done replacing');
