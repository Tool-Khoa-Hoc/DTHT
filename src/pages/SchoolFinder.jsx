import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// Helper to normalize Vietnamese text for search
function normalizeText(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Helper to determine score type from method string
function getScoreType(method = '') {
  const m = method.toLowerCase();
  if (m.includes('thpt') || m.includes('tốt nghiệp')) return 'thpt';
  if (m.includes('học bạ') || m.includes('hba')) return 'hb';
  if (m.includes('đgnl') && (m.includes('hcm') || m.includes('hồ chí minh') || m.includes('đại học quốc gia tp. hcm'))) return 'vact';
  if (m.includes('đgnl') && (m.includes('hn') || m.includes('hà nội') || m.includes('quốc gia hà nội'))) return 'hsa';
  if (m.includes('tsa') || m.includes('tư duy') || m.includes('bách khoa')) return 'tsa';
  return 'other';
}

const METHOD_LABELS = { thpt: 'THPT', tsa: 'TSA', vact: 'ĐGNL HCM', hsa: 'ĐGNL HN', hb: 'Học bạ', other: 'Theo PT Khác' };
const METHOD_COLORS = { thpt: '#306ee8', tsa: '#8b5cf6', vact: '#e36488', hsa: '#10b981', hb: '#f59e0b', other: '#64748b' };

function MethodBadge({ type }) {
  if (type === 'other') return null;
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap"
      style={{ background: METHOD_COLORS[type] + '22', color: METHOD_COLORS[type], border: `1px solid ${METHOD_COLORS[type]}44` }}>
      {METHOD_LABELS[type]}
    </span>
  );
}

function SchoolCard({ school, myScores, subjectGroupFilter, query }) {
  const [open, setOpen] = useState(false);
  
  // Filter majors based on subjectGroupFilter if provided
  const filteredMajors = useMemo(() => {
    let majors = school.majors;
    if (subjectGroupFilter && subjectGroupFilter.trim() !== '') {
      const sgQuery = normalizeText(subjectGroupFilter.trim());
      majors = majors.filter(m => m.subject_groups && normalizeText(m.subject_groups).includes(sgQuery));
    }
    if (query && query.trim() !== '') {
      const q = normalizeText(query.trim());
      const matchesSchool = normalizeText(school.university_name).includes(q) || normalizeText(school.university_code).includes(q);
      if (!matchesSchool) {
        majors = majors.filter(m => 
          normalizeText(m.major_name).includes(q) || 
          normalizeText(m.subject_groups).includes(q)
        );
      }
    }
    return majors;
  }, [school.majors, subjectGroupFilter, query, school.university_name, school.university_code]);

  // Find which methods this school has across all its FILTERED majors
  const schoolMethodTypes = new Set();
  
  filteredMajors.forEach(m => {
    const type = getScoreType(m.method);
    schoolMethodTypes.add(type);
  });

  // Calculate qualification
  let hasEligibleMajor = false;
  filteredMajors.forEach(m => {
    const type = getScoreType(m.method);
    if (type !== 'other' && myScores[type] > 0 && myScores[type] >= m.score) {
      hasEligibleMajor = true;
    }
  });

  const methodsList = Array.from(schoolMethodTypes);
  
  // Group majors by method type for rendering inside
  const groupedMajors = useMemo(() => {
    const groups = {};
    filteredMajors.forEach(m => {
      const type = getScoreType(m.method);
      if (!groups[type]) groups[type] = [];
      groups[type].push(m);
    });
    return groups;
  }, [filteredMajors]);
  
  return (
    <div className={`bg-[#0f172a]/60 border rounded-2xl overflow-hidden transition-all ${hasEligibleMajor ? 'border-green-500/30' : 'border-white/10'}`}>
      <div className="p-4 cursor-pointer flex items-start gap-3" onClick={() => setOpen(o => !o)}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold ${hasEligibleMajor ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-slate-500'}`}>
          {hasEligibleMajor ? <span className="material-symbols-outlined text-base">check_circle</span>
            : <span className="material-symbols-outlined text-base">apartment</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-sm text-white leading-tight">{school.university_name}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {school.university_code}
              </p>
            </div>
            <span className="material-symbols-outlined text-slate-500 text-base shrink-0 mt-0.5">{open ? 'expand_less' : 'expand_more'}</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
             {/* Show unique method badges */}
             {methodsList.map(m => <MethodBadge key={m} type={m} />)}
          </div>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/8 px-4 py-3 space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
          {Object.entries(groupedMajors).map(([type, majors]) => {
            const hasMyScore = type !== 'other' && myScores[type] > 0;
            return (
              <div key={type} className="mb-4 last:mb-0">
                <div className="flex items-center gap-2 mb-2 sticky top-0 bg-[#0f172a] pb-1 z-10 border-b border-white/5">
                  <span className="text-xs font-bold text-white px-2 py-0.5 rounded-md" style={{ background: METHOD_COLORS[type] }}>{METHOD_LABELS[type]}</span>
                  {hasMyScore && (
                     <span className="text-[10px] text-slate-400">Điểm của bạn: <b className="text-white">{myScores[type].toFixed(2)}</b></span>
                  )}
                </div>
                
                <div className="space-y-1.5">
                  {majors.map((m, idx) => {
                    const isEligible = hasMyScore && myScores[type] >= m.score;
                    return (
                      <div key={idx} className="flex items-start justify-between gap-3 text-xs bg-white/5 p-2 rounded-lg border border-white/5">
                         <div className="flex-1">
                           <p className="font-semibold text-slate-200">{m.major_name}</p>
                           <p className="text-[9px] text-slate-500 mt-0.5">{m.subject_groups || 'Không ghi rõ tổ hợp'}</p>
                           {type === 'other' && <p className="text-[9px] text-slate-400 mt-0.5 italic">{m.method}</p>}
                         </div>
                         <div className="text-right shrink-0">
                           <p className="font-bold text-white mb-0.5">{m.score}</p>
                           {hasMyScore && (
                             <p className={`text-[10px] font-bold ${isEligible ? 'text-green-400' : 'text-rose-400'}`}>
                               {isEligible ? 'Đỗ' : 'Trượt'}
                             </p>
                           )}
                         </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            );
          })}
          

        </div>
      )}
    </div>
  );
}

export default function SchoolFinder() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loadingScores, setLoadingScores] = useState(true);
  const [dbScores, setDbScores] = useState(null);

  // Data fetching
  const [schoolsData, setSchoolsData] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    fetch('/data/all_schools_scores.json')
      .then(res => res.json())
      .then(data => {
        setSchoolsData(data);
        setLoadingData(false);
      })
      .catch(err => {
        console.error('Error fetching data:', err);
        setLoadingData(false);
      });
  }, []);

  useEffect(() => {
    const fetchScores = async () => {
      if (!user) {
        setLoadingScores(false);
        return;
      }
      try {
        const { data, error } = await supabase.from('profiles').select('admission_scores').eq('id', user.id).single();
        if (error) throw error;
        setDbScores(data?.admission_scores || {});
      } catch (err) {
        console.error("Error fetching admission scores:", err);
      } finally {
        setLoadingScores(false);
      }
    };
    fetchScores();
  }, [user]);

  const myScores = useMemo(() => {
    if (!dbScores) return { thpt: 0, vact: 0, tsa: 0, hsa: 0, hb: 0 };
    const thpt = parseFloat(dbScores.thpt_exam_total) || 0;
    const hb = parseFloat(dbScores.thpt_transcript_total) || 0;
    const tsa  = parseFloat(localStorage.getItem('my_tsa') || '0') || 0;
    const hsa  = parseFloat(localStorage.getItem('my_hsa') || '0') || 0;
    const vact = parseFloat(localStorage.getItem('my_vact') || '0') || 0;
    return { thpt, vact, tsa, hsa, hb };
  }, [dbScores]);

  const [query, setQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [subjectGroupFilter, setSubjectGroupFilter] = useState('');
  const [displayLimit, setDisplayLimit] = useState(20);

  // Filtering
  const filtered = useMemo(() => {
    let result = schoolsData;
    
    if (query) {
       const q = normalizeText(query);
       result = result.filter(s => 
         normalizeText(s.university_name).includes(q) || 
         normalizeText(s.university_code).includes(q) ||
         s.majors.some(m => 
           normalizeText(m.major_name).includes(q) || 
           normalizeText(m.subject_groups).includes(q)
         )
       );
    }
    
    if (methodFilter !== 'all') {
       result = result.filter(s => {
         return s.majors.some(m => getScoreType(m.method) === methodFilter);
       });
    }

    if (subjectGroupFilter.trim() !== '') {
       const sgQuery = normalizeText(subjectGroupFilter.trim());
       result = result.filter(s => {
         return s.majors.some(m => normalizeText(m.subject_groups).includes(sgQuery));
       });
    }

    return result;
  }, [schoolsData, query, methodFilter, subjectGroupFilter]);

  // Sort: those where user qualifies are put first, but only if they have scores to qualify with.
  const hasAnyScore = myScores.thpt > 0 || myScores.tsa > 0 || myScores.vact > 0 || myScores.hsa > 0 || myScores.hb > 0;

  const sorted = useMemo(() => {
    if (!hasAnyScore) return filtered;
    
    const checkEligible = (school) => {
       for (const m of school.majors) {
          const type = getScoreType(m.method);
          if (type !== 'other' && myScores[type] > 0 && myScores[type] >= m.score) {
             return true;
          }
       }
       return false;
    };

    return [...filtered].sort((a, b) => {
      const elA = checkEligible(a);
      const elB = checkEligible(b);
      if (elA && !elB) return -1;
      if (!elA && elB) return 1;
      return 0;
    });
  }, [filtered, myScores, hasAnyScore]);

  const displayedSchools = useMemo(() => {
    return sorted.slice(0, displayLimit);
  }, [sorted, displayLimit]);

  useEffect(() => {
    const handleScroll = () => {
      const bottom = document.documentElement.scrollHeight - document.documentElement.scrollTop <= document.documentElement.clientHeight + 100;
      if (bottom && displayLimit < sorted.length) {
        setDisplayLimit(prev => prev + 20);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [displayLimit, sorted.length]);

  return (
    <div className="bg-[#0b0f1a] text-white min-h-screen flex flex-col font-display relative">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(at_30%_0%,rgba(48,110,232,0.10)_0,transparent_60%)]" />

      {/* Header and Top Filters */}
      <header className="shrink-0 px-4 py-4 md:px-6 md:py-5 flex flex-col bg-[#0f172a]/80 backdrop-blur-md border-b border-white/10 z-20">
        <div className="flex items-center justify-between w-full max-w-4xl mx-auto">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center hover:bg-slate-700 transition-colors shrink-0">
            <span className="material-symbols-outlined">arrow_back_ios_new</span>
          </button>
          <h1 className="text-lg md:text-xl font-bold tracking-tight">Tìm trường phù hợp</h1>
          <div className="w-10" />
        </div>

        {/* Filters Panel */}
        <div className="w-full max-w-4xl mx-auto mt-4 md:mt-5 flex flex-col md:flex-row gap-3">
           <div className="relative flex-1">
             <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-base">search</span>
             <input value={query} onChange={e => {setQuery(e.target.value); setDisplayLimit(20);}}
               placeholder="Nhập tên trường, ngành học..."
               className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-[#306ee8]/40 placeholder:text-slate-500 transition-all" />
           </div>

           <div className="flex gap-2">
             <input value={subjectGroupFilter} onChange={e => {setSubjectGroupFilter(e.target.value); setDisplayLimit(20);}}
               placeholder="Khối (VD: A00, D01)"
               className="flex-1 md:w-40 text-sm bg-white/5 border border-white/10 text-slate-300 rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-[#306ee8] placeholder:text-slate-500" />

             <select value={methodFilter} onChange={e => {setMethodFilter(e.target.value); setDisplayLimit(20);}}
               className="flex-1 md:w-48 text-sm bg-white/5 border border-white/10 text-slate-300 rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-[#306ee8]">
               <option value="all"  className="bg-[#0b0f1a]">Tất cả PT</option>
               <option value="thpt" className="bg-[#0b0f1a]">THPT Quốc gia</option>
               <option value="tsa"  className="bg-[#0b0f1a]">TSA (Bách Khoa HN)</option>
               <option value="vact" className="bg-[#0b0f1a]">VACT (ĐHQG HCM)</option>
               <option value="hsa"  className="bg-[#0b0f1a]">HSA (ĐHQG HN)</option>
               <option value="hb"   className="bg-[#0b0f1a]">Học bạ</option>
             </select>
           </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 pt-5 pb-6 space-y-4 md:space-y-5 relative z-10">

        {/* My Score Banner */}
        {hasAnyScore ? (
          <div className="bg-green-500/10 border border-green-500/25 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="material-symbols-outlined text-green-400 text-lg">verified</span>
            <div className="flex-1">
              <p className="text-xs font-bold text-green-300">Điểm của bạn đã tải từ trang Tính điểm</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {myScores.thpt > 0 && <span className="text-[10px] text-slate-300 bg-[#306ee8]/15 border border-[#306ee8]/25 rounded px-1.5 py-0.5">THPT {myScores.thpt.toFixed(2)}</span>}
                {myScores.hb > 0 && <span className="text-[10px] text-slate-300 bg-[#f59e0b]/15 border border-[#f59e0b]/25 rounded px-1.5 py-0.5">Học bạ {myScores.hb.toFixed(2)}</span>}
                {myScores.vact > 0 && <span className="text-[10px] text-slate-300 bg-[#e36488]/15 border border-[#e36488]/25 rounded px-1.5 py-0.5">VACT {myScores.vact}</span>}
                {myScores.tsa  > 0 && <span className="text-[10px] text-slate-300 bg-[#8b5cf6]/15 border border-[#8b5cf6]/25 rounded px-1.5 py-0.5">TSA {myScores.tsa.toFixed(1)}</span>}
                {myScores.hsa  > 0 && <span className="text-[10px] text-slate-300 bg-[#10b981]/15 border border-[#10b981]/25 rounded px-1.5 py-0.5">HSA {myScores.hsa.toFixed(1)}</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-400 text-lg">info</span>
            <div>
              <p className="text-xs text-amber-300 font-semibold">Chưa có điểm</p>
              <p className="text-[10px] text-slate-400">Vào <button onClick={() => navigate('/gpa')} className="underline text-amber-400">Tính điểm</button> để nhập điểm và tự động so sánh với điểm chuẩn</p>
            </div>
          </div>
        )}



        {/* ── Result count ── */}
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-slate-400">
            <span className="font-bold text-white">{sorted.length}</span> trường phù hợp
          </p>
          {hasAnyScore && <span className="text-[10px] text-green-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span> Đủ điều kiện lên trước</span>}
        </div>

        {/* ── School list ── */}
        <div className="space-y-3 pb-8">
          {loadingData ? (
             <div className="flex justify-center items-center py-10">
               <span className="material-symbols-outlined text-[#306ee8] text-4xl animate-spin">sync</span>
             </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <span className="material-symbols-outlined text-5xl block mb-3">search_off</span>
              <p className="text-sm">Không tìm thấy trường phù hợp</p>
              <p className="text-xs mt-1">Thử đổi từ khóa hoặc bỏ lọc</p>
            </div>
          ) : (
            displayedSchools.map((s, i) => <SchoolCard key={s.university_code + i} school={s} myScores={myScores} subjectGroupFilter={subjectGroupFilter} query={query} />)
          )}
          
          {displayLimit < sorted.length && !loadingData && (
             <div className="text-center py-4">
               <span className="material-symbols-outlined text-slate-500 animate-bounce">expand_more</span>
             </div>
          )}
        </div>

      </main>
    </div>
  );
}
