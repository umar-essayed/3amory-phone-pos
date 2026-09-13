import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  Smartphone,
  User,
  Phone,
  DollarSign,
  FileText,
  Key,
  Calendar,
  Edit2,
  X,
  Trash2,
} from 'lucide-react';
import { db } from '../db';
import { triggerPrint } from '../services/printer';
import type { RepairTicket, RepairStatus, StoreSettings } from '../types';

export const MaintenanceView: React.FC<{ activeShiftId: string; cashierName: string }> = ({
  activeShiftId,
  cashierName,
}) => {
  const repairs = useLiveQuery(() => db.repairs.orderBy('receivedAt').reverse().toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get(1));

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<RepairTicket | null>(null);
  const [selectedTicketForDelivery, setSelectedTicketForDelivery] = useState<RepairTicket | null>(null);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [imeiOrSerial, setImeiOrSerial] = useState('');
  const [color, setColor] = useState('');
  const [passcodeOrPattern, setPasscodeOrPattern] = useState('');
  const [accessoriesIncluded, setAccessoriesIncluded] = useState('بدون متعلقات');
  const [problemDescription, setProblemDescription] = useState('');
  const [initialInspection, setInitialInspection] = useState('');
  const [technicianName, setTechnicianName] = useState('فني الصيانة');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [warrantyDays, setWarrantyDays] = useState('14');

  // Delivery Dialog State
  const [finalCost, setFinalCost] = useState('');
  const [sparePartsCost, setSparePartsCost] = useState('');
  const [sparePartsUsed, setSparePartsUsed] = useState('');
  const [technicianCommission, setTechnicianCommission] = useState('');

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !deviceModel || !problemDescription) {
      alert('يرجى ملء الحقول الأساسية: العميل، الهاتف، نوع الجهاز، ووصف العطل.');
      return;
    }

    const ticketNumber = `REP-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTicket: RepairTicket = {
      id: `rep_${Date.now()}`,
      ticketNumber,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deviceModel: deviceModel.trim(),
      imeiOrSerial: imeiOrSerial.trim() || undefined,
      color: color.trim() || undefined,
      passcodeOrPattern: passcodeOrPattern.trim() || 'لا يوجد',
      accessoriesIncluded: accessoriesIncluded.trim(),
      problemDescription: problemDescription.trim(),
      initialInspection: initialInspection.trim(),
      technicianName,
      technicianCommission: 0,
      estimatedCost: parseFloat(estimatedCost) || 0,
      finalCost: parseFloat(estimatedCost) || 0,
      sparePartsCost: 0,
      sparePartsUsed: '',
      status: 'received',
      warrantyDays: parseInt(warrantyDays) || 14,
      receivedAt: new Date().toISOString(),
    };

    await db.repairs.add(newTicket);

    if (settings) {
      triggerPrint({
        type: 'repair_ticket',
        repair: newTicket,
        settings,
      });
    }

    setShowNewModal(false);
    resetForm();
  };

  const handleStatusChange = async (ticketId: string, newStatus: RepairStatus) => {
    await db.repairs.update(ticketId, { status: newStatus });
  };

  const handleDeliverRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketForDelivery) return;

    const costNum = parseFloat(finalCost) || 0;
    const partsNum = parseFloat(sparePartsCost) || 0;
    const techNum = parseFloat(technicianCommission) || 0;

    await db.transaction('rw', [db.repairs, db.shifts], async () => {
      await db.repairs.update(selectedTicketForDelivery.id, {
        status: 'delivered',
        finalCost: costNum,
        sparePartsCost: partsNum,
        sparePartsUsed,
        technicianCommission: techNum,
        deliveredAt: new Date().toISOString(),
      });

      // Add to shift cash in drawer
      const shift = await db.shifts.get(activeShiftId);
      if (shift) {
        await db.shifts.update(activeShiftId, {
          closingCashSystem: shift.closingCashSystem + costNum,
          totalSalesCash: shift.totalSalesCash + costNum,
        });
      }
    });

    setSelectedTicketForDelivery(null);
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setDeviceModel('');
    setImeiOrSerial('');
    setColor('');
    setPasscodeOrPattern('');
    setAccessoriesIncluded('بدون متعلقات');
    setProblemDescription('');
    setInitialInspection('');
    setEstimatedCost('');
    setWarrantyDays('14');
  };

  const handleEditTicketSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTicket) return;
    await db.repairs.update(editingTicket.id, {
      customerName: editingTicket.customerName,
      customerPhone: editingTicket.customerPhone,
      deviceModel: editingTicket.deviceModel,
      problemDescription: editingTicket.problemDescription,
      technicianName: editingTicket.technicianName,
      estimatedCost: Number(editingTicket.estimatedCost),
      warrantyDays: Number(editingTicket.warrantyDays),
      accessoriesIncluded: editingTicket.accessoriesIncluded,
      passcodeOrPattern: editingTicket.passcodeOrPattern,
    });
    setEditingTicket(null);
  };

  const filteredRepairs = repairs.filter((r) => {
    const matchesSearch =
      r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customerPhone.includes(searchQuery) ||
      r.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.deviceModel.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusBadges: Record<RepairStatus, { label: string; color: string }> = {
    received: { label: 'تم الاستلام', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    inspecting: { label: 'قيد الفحص', color: 'bg-amber-100 text-amber-800 border-amber-200' },
    waiting_approval: { label: 'انتظار الموافقة', color: 'bg-purple-100 text-purple-800 border-purple-200' },
    in_progress: { label: 'جاري الإصلاح', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    repaired: { label: 'تم الإصلاح (جاهز للتسليم)', color: 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold' },
    delivered: { label: 'تم التسليم والتحصيل', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    rejected: { label: 'تعذر الإصلاح / مرتجع', color: 'bg-red-100 text-red-800 border-red-200' },
  };

  const activeRepairsCount = repairs.filter((r) => r.status !== 'delivered' && r.status !== 'rejected').length;
  const readyRepairsCount = repairs.filter((r) => r.status === 'repaired').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold">أجهزة قيد العمل والفحص بالمحل</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">{activeRepairsCount} جهاز</h3>
            <span className="text-[10px] text-blue-600 font-semibold">في ورشة الصيانة</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Wrench className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold">أجهزة تم إصلاحها جاهزة للتسليم</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1 font-mono">{readyRepairsCount} جهاز</h3>
            <span className="text-[10px] text-emerald-600 font-semibold">بانتظار حضور العميل واستلام الكاش</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold">إجمالي كروت الصيانة المسجلة</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">{repairs.length}</h3>
            <span className="text-[10px] text-slate-400 font-semibold">تاريخ الصيانة الشامل</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <FileText className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث برقم الإيصال، اسم العميل، الهاتف، أو الجهاز..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-10 pl-4 text-xs font-semibold focus:border-blue-600 focus:bg-white focus:outline-none"
          />
          <Search className="absolute right-3.5 top-3 h-4 w-4 text-slate-400" />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="all">كل الحالات</option>
            <option value="received">تم الاستلام</option>
            <option value="inspecting">قيد الفحص</option>
            <option value="waiting_approval">انتظار موافقة العميل</option>
            <option value="in_progress">جاري الإصلاح</option>
            <option value="repaired">تم الإصلاح (جاهز)</option>
            <option value="delivered">تم التسليم والتحصيل</option>
            <option value="rejected">تعذر الإصلاح</option>
          </select>

          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 shadow-md transition shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>استلام جهاز صيانة جديد (إيصال)</span>
          </button>
        </div>
      </div>

      {/* Maintenance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRepairs.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 text-sm">
            لا توجد أجهزة صيانة مطابقة للبحث.
          </div>
        ) : (
          filteredRepairs.map((r) => {
            const badge = statusBadges[r.status] || statusBadges.received;
            return (
              <div
                key={r.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between border-b pb-3 mb-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block font-mono">
                        {new Date(r.receivedAt).toLocaleDateString('ar-EG')}
                      </span>
                      <h4 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                        <span className="font-mono text-blue-600">{r.ticketNumber}</span>
                        <span>- {r.deviceModel}</span>
                      </h4>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Customer and Passcode Info */}
                  <div className="space-y-1.5 text-xs text-slate-600 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">العميل:</span>
                      <strong className="text-slate-800">{r.customerName} ({r.customerPhone})</strong>
                    </div>
                    {r.imeiOrSerial && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">IMEI / السيريال:</span>
                        <span className="font-mono font-bold text-slate-700">{r.imeiOrSerial}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-500 font-bold flex items-center gap-1">
                        <Key className="h-3 w-3 text-amber-600" />
                        <span>رمز القفل / Pattern:</span>
                      </span>
                      <span className="font-mono font-black text-slate-900">{r.passcodeOrPattern}</span>
                    </div>
                  </div>

                  {/* Problem Description Box */}
                  <div className="bg-blue-50/50 border border-blue-100 p-2.5 rounded-xl text-xs mb-3">
                    <span className="text-[10px] font-bold text-blue-900 block mb-0.5">العطل المطلوب إصلاحه:</span>
                    <p className="text-slate-700 font-medium leading-relaxed">{r.problemDescription}</p>
                  </div>
                </div>

                {/* Status Switcher & Action Footer */}
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">تغيير الحالة:</span>
                    <select
                      value={r.status}
                      onChange={(e) => handleStatusChange(r.id, e.target.value as any)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-700"
                    >
                      <option value="received">تم الاستلام</option>
                      <option value="inspecting">قيد الفحص</option>
                      <option value="waiting_approval">انتظار الموافقة</option>
                      <option value="in_progress">جاري الإصلاح</option>
                      <option value="repaired">تم الإصلاح (جاهز)</option>
                      <option value="delivered">تم التسليم</option>
                      <option value="rejected">تعذر الإصلاح</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 block">التكلفة:</span>
                      <span className="font-mono font-black text-sm text-blue-700">
                        {r.finalCost > 0 ? r.finalCost.toLocaleString() : r.estimatedCost.toLocaleString()}{' '}
                        {settings?.currency || 'ج'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (settings) {
                            triggerPrint({
                              type: 'repair_ticket',
                              repair: r,
                              settings,
                            });
                          }
                        }}
                        title="طباعة إيصال استلام الصيانة"
                        className="p-2 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 transition cursor-pointer"
                      >
                        <Printer className="h-4 w-4" />
                      </button>

                      {/* Edit Ticket */}
                      {r.status !== 'delivered' && (
                        <button
                          type="button"
                          onClick={() => setEditingTicket({ ...r })}
                          title="تعديل بيانات التذكرة"
                          className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 transition cursor-pointer"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`حذف تذكرة الصيانة #${r.ticketNumber}؟`)) {
                            await db.repairs.delete(r.id);
                          }
                        }}
                        title="حذف التذكرة"
                        className="p-2 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-400 transition cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      {r.status !== 'delivered' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTicketForDelivery(r);
                            setFinalCost(r.estimatedCost.toString());
                          }}
                          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>تسليم وتحصيل</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: New Repair Ticket */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Wrench className="h-5 w-5 text-blue-600" />
                <span>إصدار إيصال وتذكرة صيانة جديدة</span>
              </h3>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم العميل</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="مثال: أحمد مصطفى"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم هاتف العميل</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نوع وموديل الجهاز</label>
                  <input
                    type="text"
                    value={deviceModel}
                    onChange={(e) => setDeviceModel(e.target.value)}
                    placeholder="مثال: iPhone 11 أو Samsung A54"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">السيريال / IMEI (اختياري)</label>
                  <input
                    type="text"
                    value={imeiOrSerial}
                    onChange={(e) => setImeiOrSerial(e.target.value)}
                    placeholder="رقم الـ IMEI أو السيريال"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رمز القفل أو الباسورد (Pattern/PIN)</label>
                  <input
                    type="text"
                    value={passcodeOrPattern}
                    onChange={(e) => setPasscodeOrPattern(e.target.value)}
                    placeholder="1234 أو شكل النمط"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المتعلقات المستلمة مع الجهاز</label>
                  <input
                    type="text"
                    value={accessoriesIncluded}
                    onChange={(e) => setAccessoriesIncluded(e.target.value)}
                    placeholder="جراب، شاحن، بدون شريحة..."
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">وصف العطل بدقة</label>
                  <textarea
                    rows={2}
                    value={problemDescription}
                    onChange={(e) => setProblemDescription(e.target.value)}
                    placeholder="مثال: تغيير شاشة أصلية، الجهاز لا يشحن بعد السقوط في الماء..."
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التكلفة التقديرية المبدئية</label>
                  <input
                    type="number"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">مدة الضمان بعد الإصلاح (بالأيام)</label>
                  <input
                    type="number"
                    value={warrantyDays}
                    onChange={(e) => setWarrantyDays(e.target.value)}
                    placeholder="14"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-xs font-bold shadow transition"
                >
                  حفظ وطباعة إيصال الاستلام
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dialog: Deliver & Cash Out Repair */}
      {selectedTicketForDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span>تسليم جهاز الصيانة وتحصيل الكاش</span>
            </h3>

            <div className="bg-slate-50 p-3 rounded-xl mb-4 text-xs space-y-1">
              <div>إيصال رقم: <strong className="font-mono">{selectedTicketForDelivery.ticketNumber}</strong></div>
              <div>العميل: <strong>{selectedTicketForDelivery.customerName}</strong></div>
              <div>الجهاز: <strong>{selectedTicketForDelivery.deviceModel}</strong></div>
            </div>

            <form onSubmit={handleDeliverRepair} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المبلغ النهائي المحصل من العميل نقداً ({settings?.currency || 'ج.م'})
                </label>
                <input
                  type="number"
                  value={finalCost}
                  onChange={(e) => setFinalCost(e.target.value)}
                  className="w-full rounded-xl border-2 border-emerald-400 p-2.5 text-sm font-black font-mono text-emerald-700 focus:border-emerald-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  تكلفة قطع الغيار المستخدمة (من المحل)
                </label>
                <input
                  type="number"
                  value={sparePartsCost}
                  onChange={(e) => setSparePartsCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs font-mono focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  عمولة / أجر الفني من المصنعية
                </label>
                <input
                  type="number"
                  value={technicianCommission}
                  onChange={(e) => setTechnicianCommission(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs font-mono focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setSelectedTicketForDelivery(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 text-xs font-bold shadow transition"
                >
                  تأكيد التسليم وتحصيل الكاش في الدرج
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: Edit Repair Ticket */}
      {editingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden my-4">
            <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <Edit2 className="h-5 w-5 text-white" />
                <h3 className="font-display text-lg font-bold text-white">
                  تعديل تذكرة #{editingTicket.ticketNumber}
                </h3>
              </div>
              <button onClick={() => setEditingTicket(null)} className="text-white/70 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEditTicketSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم العميل</label>
                  <input
                    type="text"
                    value={editingTicket.customerName}
                    onChange={(e) => setEditingTicket((p) => p ? { ...p, customerName: e.target.value } : null)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-bold focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">هاتف العميل</label>
                  <input
                    type="tel"
                    value={editingTicket.customerPhone}
                    onChange={(e) => setEditingTicket((p) => p ? { ...p, customerPhone: e.target.value } : null)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">نوع/موديل الجهاز</label>
                <input
                  type="text"
                  value={editingTicket.deviceModel}
                  onChange={(e) => setEditingTicket((p) => p ? { ...p, deviceModel: e.target.value } : null)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-bold focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">وصف العطل</label>
                <textarea
                  value={editingTicket.problemDescription}
                  onChange={(e) => setEditingTicket((p) => p ? { ...p, problemDescription: e.target.value } : null)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-indigo-500 focus:outline-none resize-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">الفني المسؤول</label>
                  <input
                    type="text"
                    value={editingTicket.technicianName}
                    onChange={(e) => setEditingTicket((p) => p ? { ...p, technicianName: e.target.value } : null)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">التكلفة المتوقعة</label>
                  <input
                    type="number"
                    value={editingTicket.estimatedCost}
                    onChange={(e) => setEditingTicket((p) => p ? { ...p, estimatedCost: Number(e.target.value) } : null)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">ضمان (أيام)</label>
                  <input
                    type="number"
                    value={editingTicket.warrantyDays}
                    onChange={(e) => setEditingTicket((p) => p ? { ...p, warrantyDays: Number(e.target.value) } : null)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTicket(null)}
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
    </div>
  );
};
