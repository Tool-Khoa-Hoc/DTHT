import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

export default function Home() {
  const { user, profile } = useAuth();

  const renderStatus = () => {
    if (!user || !profile) {
      return (
        <>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Trạng thái</p>
          <p className="font-bold text-sm">Vui lòng đăng nhập</p>
        </>
      );
    }

    if (profile.user_mode === 'university') {
      return (
        <>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">GPA Mục tiêu</p>
          <p className="font-bold text-sm tracking-tight">{profile.target_gpa ? `${profile.target_gpa}/4.0` : 'Chưa thiết lập'}</p>
        </>
      );
    }

    // Highschool
    return (
      <>
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Mục tiêu THPT</p>
        <div className="flex flex-col">
          <p className="font-bold text-sm tracking-tight">{profile.target_thpt ? `${profile.target_thpt} điểm` : 'Chưa thiết lập'}</p>
          {profile.target_dgnl && (
            <p className="text-[10px] text-slate-400">ĐGNL: {profile.target_dgnl}</p>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="bg-gradient-to-b from-[#201216] to-[#150a0d] min-h-screen pb-24 text-white">


      <main className="relative flex flex-col items-center">
        <div className="absolute inset-0 bg-[radial-gradient(at_0%_0%,rgba(227,100,136,0.15)_0px,transparent_50%),radial-gradient(at_100%_100%,rgba(227,100,136,0.1)_0px,transparent_50%)] pointer-events-none"></div>

        <div className="w-full max-w-5xl px-4 py-8 flex flex-col gap-8 relative z-10 block">
          {/* Hero Section */}
          <section className="flex flex-col md:flex-row gap-6">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-2xl flex flex-col gap-6 relative overflow-hidden flex-1 group hover:border-[#e36488]/30 transition-colors">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#e36488]/20 rounded-full blur-2xl"></div>
              <h2 className="text-3xl font-extrabold leading-tight">
                Tính điểm nhanh.<br />
                <span className="text-[#e36488]">Học nhẹ hơn</span> mỗi ngày.
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Máy tính điểm GPA/điểm trung bình + thư viện tài liệu dành riêng cho học sinh, sinh viên Việt Nam.
              </p>
              <div className="flex flex-col gap-3 mt-2">
                <Link to="/gpa" className="bg-[#e36488] text-white h-12 rounded-full font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#e36488]/20 hover:bg-[#d05378] transition-colors">
                  <span className="material-symbols-outlined">calculate</span>
                  Tính điểm ngay
                </Link>
                <Link to="/library" className="bg-white/5 text-slate-200 h-12 rounded-full font-bold flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors">
                  Xem tài liệu
                </Link>
              </div>
            </div>

            {/* Floating Tool Card (Glassmorphism Visual) */}
            <Link to="/profile" className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-xl flex items-center justify-between border-l-4 border-l-[#e36488] hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#e36488]/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#e36488]">user_attributes</span>
                </div>
                <div>
                  {renderStatus()}
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-500">chevron_right</span>
            </Link>
          </section>

          {/* Tools Grid */}
          <section className="w-full max-w-5xl flex flex-col">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#e36488] text-2xl">grid_view</span>
              Công cụ học tập
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link to="/gpa" className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex flex-col gap-4 hover:bg-[#e36488]/10 hover:border-[#e36488]/30 transition-all group">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-blue-400">add_chart</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm">Tính GPA</h4>
                  <p className="text-[10px] text-slate-400">Hệ 4 và hệ 10</p>
                </div>
                <button className="text-[11px] font-bold text-[#e36488] flex items-center gap-1">Dùng ngay <span className="material-symbols-outlined text-xs">arrow_forward</span></button>
              </Link>
              <Link to="/gpa" className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-xl flex flex-col gap-3 hover:bg-orange-500/10 hover:border-orange-500/30 transition-all group">
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-orange-400">swap_horiz</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm">Quy đổi điểm</h4>
                  <p className="text-[10px] text-slate-400">ABC sang số</p>
                </div>
                <button className="text-[11px] font-bold text-orange-400 flex items-center gap-1">Dùng ngay <span className="material-symbols-outlined text-xs">arrow_forward</span></button>
              </Link>
              <Link to="/gpa" className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-xl flex flex-col gap-3 hover:bg-green-500/10 hover:border-green-500/30 transition-all group">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-green-400">menu_book</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm">Tính học bạ</h4>
                  <p className="text-[10px] text-slate-400">Xét tuyển ĐH</p>
                </div>
                <button className="text-[11px] font-bold text-green-400 flex items-center gap-1">Dùng ngay <span className="material-symbols-outlined text-xs">arrow_forward</span></button>
              </Link>
              <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-xl flex flex-col gap-3 opacity-70">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-purple-400">query_stats</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm">Dự đoán điểm</h4>
                  <p className="text-[10px] text-slate-400">Mục tiêu cuối kỳ</p>
                </div>
                <button className="text-[11px] font-bold text-slate-500 flex items-center gap-1">Sắp ra mắt</button>
              </div>
            </div>
          </section>

          {/* Stats */}
          <section className="w-full max-w-5xl">
            <div className="bg-gradient-to-r from-[#e36488] to-[#ff8c72] rounded-2xl p-8 flex justify-around text-center shadow-lg shadow-[#e36488]/20">
              <div>
                <p className="text-2xl font-extrabold text-white">50k+</p>
                <p className="text-[10px] text-white/80 uppercase font-bold">Lượt tính điểm</p>
              </div>
              <div className="w-px h-10 bg-white/20 my-auto"></div>
              <div>
                <p className="text-3xl font-extrabold text-white">10k+</p>
                <p className="text-xs text-white/90 uppercase font-bold mt-1 tracking-wider">Tài liệu</p>
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
