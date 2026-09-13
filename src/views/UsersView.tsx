import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  Lock,
  UserCheck,
  X,
  CheckCircle2,
  Key,
  Crown,
  Wrench,
  BadgeCheck,
} from 'lucide-react';
import { db } from '../db';
import { useModal } from '../context/ModalContext';
import type { User } from '../types';

type UserRole = 'owner' | 'manager' | 'cashier' | 'technician';

const ROLES: { value: UserRole; label: string; color: string; bg: string; Icon: React.ElementType }[] = [
  { value: 'owner', label: 'مالك المحل', color: 'text-purple-700', bg: 'bg-purple-100', Icon: Crown },
  { value: 'manager', label: 'مدير', color: 'text-blue-700', bg: 'bg-blue-100', Icon: ShieldCheck },
  { value: 'cashier', label: 'كاشير', color: 'text-emerald-700', bg: 'bg-emerald-100', Icon: BadgeCheck },
  { value: 'technician', label: 'تقني / صيانة', color: 'text-amber-700', bg: 'bg-amber-100', Icon: Wrench },
];

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  owner: ['كل الصلاحيات', 'الإعدادات والمستخدمين', 'المبيعات والمخزون', 'التحليلات والتقارير', 'المحافظ والعمولات', 'الصيانة', 'الورديات'],
  manager: ['المبيعات والمخزون', 'التحليلات والتقارير', 'المحافظ والعمولات', 'الصيانة', 'الورديات'],
  cashier: ['المبيعات فقط', 'الورديات', 'عرض المخزون'],
  technician: ['قسم الصيانة', 'عرض الهواتف والإكسسوارات'],
};

const EMPTY_FORM = {
  username: '',
  displayName: '',
  pin: '',
  confirmPin: '',
  role: 'cashier' as UserRole,
};

export const UsersView: React.FC = () => {
  const { showAlert, showToast } = useModal();
  const users = useLiveQuery(() => db.users.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get(1));

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saved, setSaved] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeCount = users.filter((u) => u.isActive).length;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.pin || !form.displayName) {
      showAlert('يرجى ملء جميع الحقول المطلوبة.', 'بيانات ناقصة', 'warning');
      return;
    }
    if (form.pin.length < 4) {
      showAlert('يجب أن يتكون رمز الـ PIN من 4 أرقام على الأقل.', 'PIN قصير', 'warning');
      return;
    }
    if (form.pin !== form.confirmPin) {
      showAlert('رمز الـ PIN غير متطابق مع التأكيد!', 'عدم تطابق', 'error');
      return;
    }
    const existing = await db.users.where('username').equals(form.username).first();
    if (existing) {
      showAlert('اسم المستخدم هذا مسجل مسبقاً!', 'اسم مستخدم مكرر', 'error');
      return;
    }

    const newUser: User = {
      id: `user_${Date.now()}`,
      username: form.username.trim(),
      displayName: form.displayName.trim(),
      pin: form.pin,
      role: form.role,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    await db.users.add(newUser);
    setShowAddModal(false);
    setForm(EMPTY_FORM);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    await db.users.update(editingUser.id, {
      displayName: editingUser.displayName,
      role: editingUser.role,
      isActive: editingUser.isActive,
      ...(editingUser.pin ? { pin: editingUser.pin } : {}),
    });
    setEditingUser(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const toggleActive = async (user: User) => {
    await db.users.update(user.id, { isActive: !user.isActive });
  };

  const handleDelete = async (id: string) => {
    if (users.length <= 1) {
      showAlert('لا يمكن حذف المستخدم الأخير المتبقي في النظام!', 'تنبيه أمني', 'warning');
      return;
    }
    await db.users.delete(id);
    showToast('تم حذف المستخدم بنجاح');
    setConfirmDeleteId(null);
  };

  const getRoleInfo = (role: string) => ROLES.find((r) => r.value === role) || ROLES[2];

  return (
    <div className="space-y-5 pb-12">
      {/* Success Banner */}
      {saved && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-500 text-white px-5 py-3.5 font-bold shadow-lg animate-bounce">
          <CheckCircle2 className="h-5 w-5" />
          <span>تم الحفظ بنجاح!</span>
        </div>
      )}

      {/* Header Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {ROLES.map(({ value, label, color, bg, Icon }) => {
          const count = users.filter((u) => u.role === value).length;
          return (
            <div key={value} className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex items-center gap-3">
              <div className={`h-11 w-11 rounded-2xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold">{label}</p>
                <p className={`text-2xl font-black font-mono ${color}`}>{count}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-display font-bold text-slate-900">إدارة المستخدمين والصلاحيات</h2>
              <p className="text-[11px] text-slate-400 font-semibold">{activeCount} مستخدم نشط من أصل {users.length}</p>
            </div>
          </div>
          <button
            onClick={() => { setForm(EMPTY_FORM); setShowAddModal(true); }}
            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold px-5 py-2.5 shadow-sm transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة مستخدم</span>
          </button>
        </div>

        <div className="divide-y divide-slate-50">
          {users.length === 0 ? (
            <div className="py-20 text-center text-slate-400">لا يوجد مستخدمون بعد</div>
          ) : (
            users.map((user) => {
              const roleInfo = getRoleInfo(user.role);
              const perms = ROLE_PERMISSIONS[user.role as UserRole] || [];
              return (
                <div key={user.id} className={`p-5 flex items-center gap-4 transition ${!user.isActive ? 'opacity-50' : ''}`}>
                  {/* Avatar */}
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 ${roleInfo.bg} ${roleInfo.color}`}>
                    {(user.displayName || user.username).charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-slate-900 text-sm">{user.displayName || user.username}</p>
                      {!user.isActive && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold">معطل</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-mono">@{user.username}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full ${roleInfo.bg} ${roleInfo.color} text-[11px] font-bold`}>
                        <roleInfo.Icon className="h-3 w-3" />
                        {roleInfo.label}
                      </span>
                      {perms.slice(0, 3).map((p) => (
                        <span key={p} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold">
                          {p}
                        </span>
                      ))}
                      {perms.length > 3 && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px]">+{perms.length - 3} أخرى</span>
                      )}
                    </div>
                  </div>

                  {/* PIN indicator */}
                  <div className="flex items-center gap-1 text-slate-300 shrink-0">
                    <Key className="h-3.5 w-3.5" />
                    <span className="text-xs font-mono">{'•'.repeat(user.pin.length)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleActive(user)}
                      title={user.isActive ? 'تعطيل المستخدم' : 'تفعيل المستخدم'}
                      className={`p-2 rounded-xl transition cursor-pointer ${
                        user.isActive
                          ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {user.isActive ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => setEditingUser({ ...user, pin: '' })}
                      title="تعديل"
                      className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition cursor-pointer"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(user.id)}
                      title="حذف"
                      className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Info Card: PIN Login Instructions */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
            <Lock className="h-5 w-5 text-blue-700" />
          </div>
          <div>
            <h3 className="font-display font-bold text-blue-900 text-sm mb-1">نظام الصلاحيات والدخول بالـ PIN</h3>
            <p className="text-xs text-blue-700 leading-relaxed">
              كل كاشير يدخل النظام برقم الـ PIN الخاص به. يمكن تغيير الكاشير النشط من القائمة العلوية في أي وقت أثناء الوردية.
              المالك والمدير يمكنهم الوصول لكل الأقسام، بينما الكاشير يرى المبيعات والمخزون فقط، والتقني يرى قسم الصيانة.
            </p>
          </div>
        </div>
      </div>

      {/* MODAL: Add User */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-white">إضافة مستخدم جديد</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-xl bg-white/20 text-white hover:bg-white/30 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">الاسم الظاهر *</label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
                    placeholder="أحمد محمد"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold focus:border-blue-500 focus:outline-none"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم المستخدم *</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                    placeholder="ahmed123"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-mono focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الصلاحية</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(({ value, label, Icon, color, bg }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, role: value }))}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 text-xs font-bold transition cursor-pointer ${
                        form.role === value
                          ? `border-blue-500 ${bg} ${color}`
                          : 'border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
                {/* Permissions preview */}
                <div className="mt-2 p-3 bg-slate-50 rounded-xl">
                  <p className="text-[10px] text-slate-500 font-bold mb-1">الصلاحيات:</p>
                  <div className="flex flex-wrap gap-1">
                    {ROLE_PERMISSIONS[form.role].map((p) => (
                      <span key={p} className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 rounded-full text-[10px] font-semibold">{p}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">رمز PIN (4-6 أرقام) *</label>
                  <div className="relative">
                    <input
                      type={showPin ? 'text' : 'password'}
                      value={form.pin}
                      onChange={(e) => setForm((p) => ({ ...p, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                      placeholder="••••"
                      maxLength={6}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-mono tracking-widest focus:border-blue-500 focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">تأكيد الـ PIN *</label>
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={form.confirmPin}
                    onChange={(e) => setForm((p) => ({ ...p, confirmPin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                    placeholder="••••"
                    maxLength={6}
                    className={`w-full rounded-xl border p-3 text-sm font-mono tracking-widest focus:outline-none ${
                      form.confirmPin && form.pin !== form.confirmPin
                        ? 'border-red-400 bg-red-50'
                        : 'border-slate-200 bg-slate-50 focus:border-blue-500'
                    }`}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white py-2.5 text-sm font-bold shadow-sm transition cursor-pointer"
                >
                  إنشاء المستخدم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit User */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <Edit2 className="h-5 w-5 text-white" />
                <h3 className="font-display text-lg font-bold text-white">تعديل بيانات المستخدم</h3>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-white/70 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الاسم الظاهر</label>
                <input
                  type="text"
                  value={editingUser.displayName || ''}
                  onChange={(e) => setEditingUser((p) => p ? { ...p, displayName: e.target.value } : null)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الصلاحية</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(({ value, label, Icon, color, bg }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setEditingUser((p) => p ? { ...p, role: value as any } : null)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 text-xs font-bold transition cursor-pointer ${
                        editingUser.role === value
                          ? `border-indigo-500 ${bg} ${color}`
                          : 'border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">PIN جديد (اتركه فارغاً للإبقاء على الحالي)</label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={editingUser.pin}
                    onChange={(e) => setEditingUser((p) => p ? { ...p, pin: e.target.value.replace(/\D/g, '').slice(0, 6) } : null)}
                    placeholder="اتركه فارغاً للإبقاء على PIN الحالي"
                    maxLength={6}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-mono tracking-widest focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute left-3 top-3 text-slate-400 cursor-pointer"
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-slate-800">حالة الحساب</p>
                  <p className="text-xs text-slate-500">{editingUser.isActive ? 'الحساب نشط ومفعّل' : 'الحساب معطل'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingUser((p) => p ? { ...p, isActive: !p.isActive } : null)}
                  className={`relative h-6 w-11 rounded-full transition cursor-pointer ${
                    editingUser.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    editingUser.isActive ? 'right-0.5' : 'left-0.5'
                  }`} />
                </button>
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white py-2.5 text-sm font-bold shadow-sm transition cursor-pointer"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Delete */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-3xl bg-white shadow-2xl p-6 text-center">
            <div className="h-16 w-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="font-display font-black text-slate-900 text-lg">تأكيد الحذف</h3>
            <p className="text-sm text-slate-500 mt-2">سيتم حذف هذا المستخدم نهائياً. هل أنت متأكد؟</p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white py-2.5 text-sm font-bold transition cursor-pointer"
              >
                حذف نهائي
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
