import { useState } from 'react';
import { LayoutTemplate, Lock, Loader2, ArrowRight } from 'lucide-react';

export default function DocStudioLogin({ onLogin, isMock }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isMock) {
                // Giả lập mạng chậm một chút trong mock mode
                await new Promise(resolve => setTimeout(resolve, 800));
            }
            await onLogin(email, password);
        } catch (err) {
            console.error(err);
            setError('Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full min-h-[80vh] bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
                <div className="p-8 pb-6 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white text-center">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30 mx-auto mb-4">
                        <LayoutTemplate size={28} strokeWidth={2} className="text-white" />
                    </div>
                    <h2 className="text-2xl font-black tracking-tight uppercase">DocStudio</h2>
                    <p className="text-indigo-200 text-sm mt-1">Đăng nhập hệ thống quản lý tài liệu</p>
                </div>

                <div className="p-8">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-medium text-center">
                            {error}
                        </div>
                    )}

                    {isMock && (
                        <div className="mb-6 p-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs text-center">
                            Hệ thống đang chạy MOCK Mode (Demo). Bấm Đăng Nhập trực tiếp mà không cần mật khẩu.
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                autoComplete="email"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-slate-700 font-medium"
                                placeholder="admin@docstudio.local"
                                required={!isMock}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Mật khẩu</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-slate-700 font-medium pr-10"
                                    placeholder="••••••••"
                                    required={!isMock}
                                />
                                <Lock size={16} className="absolute right-4 top-3.5 text-slate-400" />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98]"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <><ArrowRight size={18} /> Đăng nhập</>}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
