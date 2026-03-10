import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Tabs within Admissions Admin
const ADMISSION_TABS = [
  { id: 'universities', label: 'Trường ĐH' },
  { id: 'majors', label: 'Ngành Học' },
  { id: 'methods', label: 'Phương thức' },
  { id: 'benchmarks', label: 'Nhập Điểm Chuẩn' }
];

export default function AdmissionsAdmin() {
  const [activeTab, setActiveTab] = useState('universities');
  const [message, setMessage] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex bg-slate-100 dark:bg-[#1a0f12] p-1 rounded-xl border border-slate-200 dark:border-white/5">
        {ADMISSION_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === tab.id
              ? 'bg-[#7f13ec] text-white shadow-md'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {message && (
        <div className="p-3 bg-green-500/10 text-green-600 border border-green-500/20 rounded-xl text-sm font-medium">
          {message}
        </div>
      )}

      {activeTab === 'universities' && <UniversityManager setMessage={setMessage} />}
      {activeTab === 'majors' && <MajorManager setMessage={setMessage} />}
      {activeTab === 'methods' && <MethodManager setMessage={setMessage} />}
      {activeTab === 'benchmarks' && <BenchmarkManager setMessage={setMessage} />}
    </div>
  );
}

function UniversityManager({ setMessage }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [region, setRegion] = useState('hanoi');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('universities').insert([{ code, name, region }]);
      if (error) throw error;
      setMessage(`Đã thêm trường ${name} (${code})`);
      setCode(''); setName('');
    } catch (error) {
      setMessage('Lỗi: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-[#201216] border border-slate-200 dark:border-white/5 p-5 rounded-2xl">
      <h3 className="font-bold text-[#7f13ec]">Thêm Trường Mới</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold mb-1 text-slate-500">Mã trường *</label>
          <input required value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="VD: BKA" className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-lg py-2 px-3 text-sm outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-slate-500">Khu vực *</label>
          <select value={region} onChange={e => setRegion(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-lg py-2 px-3 text-sm outline-none">
            <option value="hanoi">Miền Bắc (Hà Nội)</option>
            <option value="danang">Miền Trung (Đà Nẵng)</option>
            <option value="hcm">Miền Nam (TP.HCM)</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1 text-slate-500">Tên trường đầy đủ *</label>
        <input required value={name} onChange={e => setName(e.target.value)} placeholder="VD: Đại học Bách khoa Hà Nội" className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-lg py-2 px-3 text-sm outline-none" />
      </div>
      <button disabled={loading} className="w-full py-2 bg-[#7f13ec]/20 text-[#7f13ec] font-bold rounded-lg hover:bg-[#7f13ec] hover:text-white transition-colors">
        {loading ? 'Đang thêm...' : 'Thêm Trường'}
      </button>
    </form>
  );
}

function MajorManager({ setMessage }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('majors').insert([{ code, name }]);
      if (error) throw error;
      setMessage(`Đã thêm ngành gốc: ${name} (${code})`);
      setCode(''); setName('');
    } catch (error) {
      setMessage('Lỗi: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-[#201216] border border-slate-200 dark:border-white/5 p-5 rounded-2xl">
      <h3 className="font-bold text-[#7f13ec]">Thêm Ngành Gốc (Danh mục Bộ GD)</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold mb-1 text-slate-500">Mã ngành *</label>
          <input required value={code} onChange={e => setCode(e.target.value)} placeholder="VD: 7480201" className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-lg py-2 px-3 text-sm outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-slate-500">Tên ngành chuẩn *</label>
          <input required value={name} onChange={e => setName(e.target.value)} placeholder="VD: Công nghệ thông tin" className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-lg py-2 px-3 text-sm outline-none" />
        </div>
      </div>
      <button disabled={loading} className="w-full py-2 bg-[#7f13ec]/20 text-[#7f13ec] font-bold rounded-lg hover:bg-[#7f13ec] hover:text-white transition-colors">
        {loading ? 'Đang thêm...' : 'Thêm Ngành'}
      </button>
    </form>
  );
}

function MethodManager({ setMessage }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('admission_methods').insert([{ code, name }]);
      if (error) throw error;
      setMessage(`Đã thêm phương thức: ${code}`);
      setCode(''); setName('');
    } catch (error) {
      setMessage('Lỗi: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-[#201216] border border-slate-200 dark:border-white/5 p-5 rounded-2xl">
      <h3 className="font-bold text-[#7f13ec]">Thêm Phương Thức Tuyển Sinh</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold mb-1 text-slate-500">Mã PT (thpt, hba, ts, ...)*</label>
          <input required value={code} onChange={e => setCode(e.target.value.toLowerCase())} placeholder="VD: thpt" className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-lg py-2 px-3 text-sm outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-slate-500">Tên Phương Thức *</label>
          <input required value={name} onChange={e => setName(e.target.value)} placeholder="VD: Xét điểm thi THPT Quốc gia" className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-lg py-2 px-3 text-sm outline-none" />
        </div>
      </div>
      <button disabled={loading} className="w-full py-2 bg-[#7f13ec]/20 text-[#7f13ec] font-bold rounded-lg hover:bg-[#7f13ec] hover:text-white transition-colors">
        {loading ? 'Đang thêm...' : 'Thêm Phương Thức'}
      </button>
    </form>
  );
}

function BenchmarkManager({ setMessage }) {
  const [unis, setUnis] = useState([]);
  const [majors, setMajors] = useState([]);
  const [methods, setMethods] = useState([]);

  const [loadingUni, setLoadingUni] = useState(false);

  // Form State
  const [selectedUni, setSelectedUni] = useState('');
  const [selectedMajor, setSelectedMajor] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [year, setYear] = useState('2024');
  const [score, setScore] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const [uRes, mRes, meRes] = await Promise.all([
        supabase.from('universities').select('id, code, name'),
        supabase.from('majors').select('id, code, name'),
        supabase.from('admission_methods').select('id, code, name')
      ]);
      if (uRes.data) setUnis(uRes.data);
      if (mRes.data) setMajors(mRes.data);
      if (meRes.data) setMethods(meRes.data);
    };
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUni || !selectedMajor || !selectedMethod || !score) {
      setMessage("Lỗi: Vui lòng chọn đầy đủ trường, ngành, phương thức và nhập điểm.");
      return;
    }

    setLoadingUni(true);
    try {
      // 1. Create mapping in university_majors first if it doesn't exist
      let umId;
      const { data: umData } = await supabase
        .from('university_majors')
        .select('id')
        .eq('university_id', selectedUni)
        .eq('major_id', selectedMajor)
        .single();

      if (umData) {
        umId = umData.id;
      } else {
        const { data: newUm, error: umErr } = await supabase
          .from('university_majors')
          .insert([{ university_id: selectedUni, major_id: selectedMajor }])
          .select('id').single();
        if (umErr) throw umErr;
        umId = newUm.id;
      }

      // 2. Insert into admission_benchmarks
      const { error: bErr } = await supabase
        .from('admission_benchmarks')
        .insert([{
          university_major_id: umId,
          year: parseInt(year),
          method_id: selectedMethod,
          score: parseFloat(score)
        }]);

      if (bErr) throw bErr;
      setMessage(`Đã nhập điểm chuẩn ${score} thành công!`);
      setScore('');
    } catch (error) {
      setMessage('Lỗi nhập điểm: ' + error.message);
    }
    setLoadingUni(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-[#201216] border border-slate-200 dark:border-white/5 p-5 rounded-2xl">
      <h3 className="font-bold text-[#7f13ec]">Nhập Điểm Chuẩn</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold mb-1 text-slate-500">Trường *</label>
          <select value={selectedUni} onChange={e => setSelectedUni(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-lg py-2 px-3 text-sm outline-none">
            <option value="">-- Chọn trường --</option>
            {unis.map(u => <option key={u.id} value={u.id}>{u.code} - {u.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-slate-500">Ngành *</label>
          <select value={selectedMajor} onChange={e => setSelectedMajor(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-lg py-2 px-3 text-sm outline-none">
            <option value="">-- Chọn ngành --</option>
            {majors.map(m => <option key={m.id} value={m.id}>{m.code} - {m.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold mb-1 text-slate-500">Năm *</label>
          <input type="number" required value={year} onChange={e => setYear(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-lg py-2 px-3 text-sm outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-slate-500">Phương thức *</label>
          <select value={selectedMethod} onChange={e => setSelectedMethod(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-lg py-2 px-3 text-sm outline-none">
            <option value="">-- Chọn PT --</option>
            {methods.map(m => <option key={m.id} value={m.id}>{m.code} - {m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-slate-500">Điểm trúng tuyển *</label>
          <input type="number" step="0.01" required value={score} onChange={e => setScore(e.target.value)} placeholder="0.0" className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-lg py-2 px-3 text-sm outline-none" />
        </div>
      </div>

      <button disabled={loadingUni} className="w-full py-2 bg-[#7f13ec]/20 text-[#7f13ec] font-bold rounded-lg hover:bg-[#7f13ec] hover:text-white transition-colors mt-2">
        {loadingUni ? 'Đang lưu...' : 'Lưu Điểm Chuẩn'}
      </button>
    </form>
  );
}
