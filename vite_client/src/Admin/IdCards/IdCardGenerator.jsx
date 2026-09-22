import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { canAccessHrDocuments } from '../../utils/managerHelper';
import {
  FiCreditCard,
  FiPlus,
  FiDownload,
  FiEye,
  FiTrash2,
  FiSearch,
  FiCheckCircle,
  FiXCircle,
  FiUsers,

  FiRotateCcw,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { downloadPdfBlob } from '../../utils/downloadPdfBlob';
import ProfilePicture from '../../Shared/ProfilePicture';
import PaarsivIdCard, { PAARSIV_ID } from '../../components/PaarsivIdCard';

const MINT = '#20C997';
const MINT_DARK = '#0d9488';
const MINT_GRADIENT = `linear-gradient(135deg, ${MINT} 0%, ${MINT_DARK} 100%)`;

/** Single brand template — physical Paarsiv badge look */
const themePresets = {
  paarsiv: {
    name: 'Paarsiv',
    backgroundColor: PAARSIV_ID.white,
    textColor: PAARSIV_ID.charcoal,
    accentColor: PAARSIV_ID.green,
    borderColor: PAARSIV_ID.border,
    headerGradient: `linear-gradient(135deg, ${PAARSIV_ID.green} 0%, ${PAARSIV_ID.charcoal} 100%)`,
  },
};

const CARD_STATUSES = ['active', 'expired', 'suspended', 'cancelled'];

/** ID card record status only (not employee employment status). */
const getCardStatus = (card) => {
  const raw = card?.status;
  if (raw && CARD_STATUSES.includes(String(raw))) return String(raw);
  return 'active';
};

const getCardStatusLabel = (status) => {
  const labels = {
    active: 'Active',
    cancelled: 'Deactivated',
    expired: 'Expired',
    suspended: 'Suspended',
  };
  return labels[status] || status;
};

const statusStyles = {
  active: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20',
  expired: 'bg-red-100 text-red-700 ring-red-600/20',
  suspended: 'bg-amber-100 text-amber-700 ring-amber-600/20',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

const typeStyles = {
  employee: 'bg-teal-50 text-teal-700',
  visitor: 'bg-violet-50 text-violet-700',
  contractor: 'bg-orange-50 text-orange-700',
  temporary: 'bg-pink-50 text-pink-700',
};

const KpiStat = ({ label, value, icon: Icon, accent }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      </div>
      <div
        className="flex h-11 w-11 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${accent}18`, color: accent }}
      >
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const IdCardMiniPreview = ({ card }) => {
  const employee = card.employeeId || {};

  return (
    <div className="transition-transform duration-300 group-hover:scale-[1.02]">
      <PaarsivIdCard
        size="mini"
        name={employee.name}
        lastName={employee.lastName}
        jobTitle={employee.position || employee.jobTitle || 'Employee'}
        employeeId={employee.employeeId}
        cardNumber={card.cardNumber}
        profilePhoto={employee.profilePhoto || employee.profilePicture}
        userId={employee._id || employee.id}
      />
    </div>
  );
};

const IdCardGenerator = () => {
  const user = useSelector((state) => state.auth.user);
  const employee = useSelector((state) => state.employeeDetails.employee);
  const permissionFlags = useSelector((state) => state.auth.permissionFlags) || {};
  const isHrUser = canAccessHrDocuments(user, employee, permissionFlags);

  const [idCards, setIdCards] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ status: '', cardType: '' });

  const [generateForm, setGenerateForm] = useState({
    employeeId: '',
    cardDesign: { template: 'paarsiv' },
  });

  const buildGeneratePayload = useCallback(() => {
    const themeKey = generateForm.cardDesign?.template || 'paarsiv';
    const theme = themePresets[themeKey] || themePresets.paarsiv;
    return {
      employeeId: generateForm.employeeId,
      cardType: 'employee',
      accessLevel: 'basic',
      accessZones: [],
      cardDesign: {
        template: themeKey === 'paarsiv' ? 'standard' : themeKey,
        backgroundColor: theme.backgroundColor,
        textColor: theme.textColor,
        companyName: 'paarsiv',
        companyAddress: PAARSIV_ID.website,
      },
    };
  }, [generateForm]);

  const fetchIdCards = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.cardType) params.append('cardType', filters.cardType);
      const response = await axios.get(`/v1/admin/id-cards?${params}`, { withCredentials: true });
      const cardsData = response.data?.data || response.data || [];
      setIdCards(Array.isArray(cardsData) ? cardsData : []);
    } catch {
      toast.error('Failed to fetch ID cards');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchEmployees = async () => {
    try {
      setEmployeesLoading(true);
      const allEmployees = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 20) {
        const response = await axios.get('/v1/employee/auth/get-all-employees', {
          params: { page, limit: 100 },
          withCredentials: true,
        });
        const body = response.data;
        const batch = Array.isArray(body)
          ? body
          : Array.isArray(body?.data)
            ? body.data
            : Array.isArray(body?.employees)
              ? body.employees
              : [];

        allEmployees.push(...batch);

        const pagination = body?.pagination;
        hasMore = pagination?.hasNext === true || (batch.length === 100 && !pagination);
        page += 1;
      }

      setEmployees(allEmployees);
    } catch {
      toast.error('Failed to fetch employees');
      setEmployees([]);
    } finally {
      setEmployeesLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchIdCards();
  }, [fetchIdCards]);

  const stats = useMemo(() => {
    const list = Array.isArray(idCards) ? idCards : [];
    return {
      total: list.length,
      active: list.filter((c) => getCardStatus(c) === 'active').length,
      deactivated: list.filter((c) => getCardStatus(c) === 'cancelled').length,
      employees: new Set(list.map((c) => c.employeeId?._id || c.employeeId).filter(Boolean)).size,
    };
  }, [idCards]);

  const employeesEligibleForCard = useMemo(() => {
    const withActiveCard = new Set(
      idCards
        .filter((c) => getCardStatus(c) === 'active')
        .map((c) => String(c.employeeId?._id || c.employeeId || ''))
        .filter(Boolean)
    );
    return employees.filter((e) => e._id && !withActiveCard.has(String(e._id)));
  }, [employees, idCards]);

  const filteredCards = useMemo(() => {
    let list = Array.isArray(idCards) ? [...idCards] : [];

    if (filters.status) {
      list = list.filter((card) => getCardStatus(card) === filters.status);
    }
    if (filters.cardType) {
      list = list.filter((card) => card.cardType === filters.cardType);
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter((card) => {
      const emp = card.employeeId || {};
      const cardStatus = getCardStatus(card);
      const haystack = [
        card.cardNumber,
        emp.name,
        emp.lastName,
        emp.employeeId,
        emp.department,
        card.cardType,
        cardStatus,
        getCardStatusLabel(cardStatus),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [idCards, searchQuery, filters.status, filters.cardType]);

  const handleGenerateCard = async (e) => {
    e.preventDefault();
    if (!generateForm.employeeId) {
      toast.error('Please select an employee');
      return;
    }
    try {
      await axios.post('/v1/admin/id-cards/generate', buildGeneratePayload(), {
        withCredentials: true,
      });
      toast.success('ID card generated successfully');
      setShowGenerateModal(false);
      resetGenerateForm();
      fetchIdCards();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to generate ID card');
    }
  };

  const handleDownloadCard = async (cardId) => {
    try {
      toast.info('Preparing ID card PDF…');
      const response = await axios.get(`/v1/admin/id-cards/card/${cardId}/download`, {
        responseType: 'blob',
        withCredentials: true,
      });
      const contentType = response.headers?.['content-type'] || '';
      if (!contentType.includes('application/pdf')) {
        const errorText = await response.data.text();
        let message = 'Failed to download ID card';
        try {
          const parsed = JSON.parse(errorText);
          message = parsed?.message || message;
        } catch {
          /* keep default */
        }
        toast.error(message);
        return;
      }
      const method = await downloadPdfBlob(response.data, `id-card-${cardId}.pdf`);
      if (method === 'share-cancelled') return;
      if (method === 'open') {
        toast.success('ID card opened — use Share/Save in the browser to keep a copy');
      } else if (method === 'share') {
        toast.success('ID card ready to save or share');
      } else {
        toast.success('ID card downloaded successfully');
      }
    } catch (error) {
      let message = 'Failed to download ID card';
      try {
        const data = error.response?.data;
        if (data instanceof Blob) {
          const text = await data.text();
          message = JSON.parse(text)?.message || message;
        } else if (data?.message) {
          message = data.message;
        }
      } catch {
        /* keep default */
      }
      toast.error(message);
    }
  };

  const handleDeactivateCard = async (cardId) => {
    if (!window.confirm('Deactivate this ID card?')) return;
    try {
      await axios.put(
        `/v1/admin/id-cards/card/${cardId}`,
        { status: 'cancelled' },
        { withCredentials: true }
      );
      toast.success('ID card deactivated');
      fetchIdCards();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to deactivate ID card');
    }
  };

  const handleReactivateCard = async (cardId) => {
    if (!window.confirm('Reactivate this ID card?')) return;
    try {
      await axios.put(
        `/v1/admin/id-cards/card/${cardId}`,
        { status: 'active' },
        { withCredentials: true }
      );
      toast.success('ID card reactivated');
      fetchIdCards();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reactivate ID card');
    }
  };

  const resetGenerateForm = () => {
    setGenerateForm({
      employeeId: '',
      cardDesign: { template: 'paarsiv' },
    });
  };

  if (!isHrUser) {
    return <Navigate to="/employee/documents-id" replace />;
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#F5F7FB]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-[#20C997] border-r-[#20C997]" />
          <p className="text-sm font-medium text-slate-600">Loading ID cards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F5F7FB]">
      <div className="page-shell">
      <div className="page-shell-inner">
      <div className="hrms-stack">
        {/* Header */}
        <header className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md"
                style={{ background: MINT_GRADIENT }}
              >
                <FiCreditCard className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">HR Workspace</p>
                <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">ID Card Management</h1>
                <p className="mt-0.5 text-sm text-slate-500">Generate and manage employee ID cards</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center w-full lg:w-auto">
              <label className="relative block min-w-0 w-full sm:min-w-[240px] flex-1 sm:max-w-sm">
                <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search cards, employees..."
                  className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-[#20C997] focus:bg-white focus:ring-2 focus:ring-[#20C997]/20"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowGenerateModal(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
                style={{ background: MINT_GRADIENT }}
              >
                <FiPlus className="h-5 w-5" />
                Generate ID Card
              </button>
            </div>
          </div>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiStat label="Total Cards" value={stats.total} icon={FiCreditCard} accent={MINT} />
          <KpiStat label="Active" value={stats.active} icon={FiCheckCircle} accent="#10b981" />
          <KpiStat label="Deactivated" value={stats.deactivated} icon={FiXCircle} accent="#64748b" />
          <KpiStat label="Employees" value={stats.employees} icon={FiUsers} accent={MINT_DARK} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          {/* <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <FiFilter className="h-4 w-4 text-[#20C997]" />
            Filters
          </div> */}
          <div className="min-w-0 w-full sm:min-w-[160px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#20C997] focus:ring-2 focus:ring-[#20C997]/20"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="cancelled">Deactivated</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="min-w-0 w-full sm:min-w-[160px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Card Type</label>
            <select
              value={filters.cardType}
              onChange={(e) => setFilters({ ...filters, cardType: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#20C997] focus:ring-2 focus:ring-[#20C997]/20"
            >
              <option value="">All Types</option>
              <option value="employee">Employee</option>
              <option value="visitor">Visitor</option>
              <option value="contractor">Contractor</option>
              <option value="temporary">Temporary</option>
            </select>
          </div>
        </div>

        {/* Grid */}
        <section className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4 md:px-6">
            <h2 className="text-lg font-semibold text-slate-900">
              ID Cards ({filteredCards.length})
            </h2>
            <p className="text-sm text-slate-500">Manage and preview all generated cards</p>
          </div>

          <div className="p-5 md:p-6">
            {filteredCards.length === 0 ? (
              <div className="py-8 sm:py-10 text-center">
                <div
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ background: `${MINT}20` }}
                >
                  <FiCreditCard className="h-8 w-8" style={{ color: MINT }} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">No ID cards found</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                  {searchQuery || filters.status || filters.cardType
                    ? 'Try adjusting your search or filters.'
                    : 'Generate your first employee ID card to get started.'}
                </p>
                {!searchQuery && !filters.status && !filters.cardType && (
                  <button
                    type="button"
                    onClick={() => setShowGenerateModal(true)}
                    className="mt-6 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white"
                    style={{ background: MINT_GRADIENT }}
                  >
                    <FiPlus className="h-4 w-4" />
                    Generate your first card
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredCards.map((card) => {
                  const emp = card.employeeId || {};
                  const cardStatus = getCardStatus(card);
                  return (
                    <article
                      key={card._id}
                      className="group overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50 transition hover:border-[#20C997]/30 hover:shadow-lg"
                    >
                      <div className="bg-gradient-to-b from-white to-slate-50 px-4 pb-2 pt-6">
                        <IdCardMiniPreview card={card} />
                      </div>

                      <div className="space-y-3 border-t border-slate-100 bg-white p-4">
                        <div className="flex items-center gap-3">
                          <ProfilePicture user={emp} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-slate-900">
                              {emp.name} {emp.lastName}
                            </p>
                            <p className="truncate text-xs text-slate-500">{emp.employeeId || '—'}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${statusStyles[cardStatus] || statusStyles.cancelled}`}
                          >
                            {getCardStatusLabel(cardStatus)}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${typeStyles[card.cardType] || 'bg-slate-100 text-slate-600'}`}
                          >
                            {card.cardType}
                          </span>
                        </div>

                        <p className="font-mono text-xs text-slate-500">{card.cardNumber}</p>

                        <div className="flex items-center justify-end gap-1 border-t border-slate-50 pt-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCard(card);
                              setShowPreviewModal(true);
                            }}
                            className="rounded-lg p-2.5 text-slate-400 transition hover:bg-[#20C997]/10 hover:text-[#0d9488] sm:p-2"
                            title="Preview"
                            aria-label="Preview ID card"
                          >
                            <FiEye className="h-5 w-5 sm:h-4 sm:w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadCard(card._id)}
                            className="rounded-lg p-2.5 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600 sm:p-2"
                            title="Download"
                            aria-label="Download ID card PDF"
                          >
                            <FiDownload className="h-5 w-5 sm:h-4 sm:w-4" />
                          </button>
                          {cardStatus === 'active' ? (
                            <button
                              type="button"
                              onClick={() => handleDeactivateCard(card._id)}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                              title="Deactivate"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          ) : cardStatus === 'cancelled' ? (
                            <button
                              type="button"
                              onClick={() => handleReactivateCard(card._id)}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-[#20C997]/10 hover:text-[#0d9488]"
                              title="Reactivate"
                            >
                              <FiRotateCcw className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
      </div>
      </div>

      {showGenerateModal && (
        <GenerateModal
          formData={generateForm}
          setFormData={setGenerateForm}
          onSubmit={handleGenerateCard}
          onClose={() => {
            setShowGenerateModal(false);
            resetGenerateForm();
          }}
          employees={employeesEligibleForCard}
          employeesLoading={employeesLoading}
        />
      )}

      {showPreviewModal && selectedCard && (
        <PreviewModal
          card={selectedCard}
          onClose={() => {
            setShowPreviewModal(false);
            setSelectedCard(null);
          }}
          onDownload={() => handleDownloadCard(selectedCard._id)}
        />
      )}
    </div>
  );
};

const GenerateModal = ({ formData, setFormData, onSubmit, onClose, employees, employeesLoading }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
    <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
      <div className="flex items-center justify-between px-6 py-5 text-white" style={{ background: MINT_GRADIENT }}>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/20 p-2.5">
            <FiCreditCard className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Generate ID Card</h3>
            <p className="text-sm text-white/80">Create a new card for an employee</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/20" aria-label="Close">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Select Employee</label>
          <select
            value={formData.employeeId}
            onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#20C997] focus:ring-2 focus:ring-[#20C997]/20"
            required
          >
            <option value="">Choose an employee...</option>
            {employeesLoading ? (
              <option disabled>Loading...</option>
            ) : employees.length === 0 ? (
              <option disabled>All employees already have ID cards</option>
            ) : (
              employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.name} {employee.lastName} — {employee.employeeId} ({employee.department || '—'})
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="mb-3 block text-sm font-semibold text-slate-700">Card Design</label>
          <div className="rounded-2xl border-2 border-[#20C997] bg-[#20C997]/5 p-4 shadow-md">
            <div className="mb-3 flex justify-center">
              <PaarsivIdCard
                size="mini"
                name="Clara"
                lastName="Jenkins"
                jobTitle="Senior Analyst"
                employeeId="EMP-2026-0001"
              />
            </div>
            <p className="text-center text-sm font-medium text-slate-800">Paarsiv Official Badge</p>
            <p className="mt-1 text-center text-xs text-slate-500">
              Sage green · charcoal · portrait layout
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-md"
            style={{ background: MINT_GRADIENT }}
          >
            Generate ID Card
          </button>
        </div>
      </form>
    </div>
  </div>
);

const PreviewModal = ({ card, onClose, onDownload }) => {
  const emp = card.employeeId || {};
  const cardStatus = getCardStatus(card);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-center justify-between px-5 py-3.5 text-white" style={{ background: MINT_GRADIENT }}>
          <div className="flex items-center gap-2.5">
            <FiEye className="h-5 w-5" />
            <div>
              <h3 className="text-base font-bold">ID Card Preview</h3>
              <p className="text-[11px] text-white/80">{card.cardNumber}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-white/20" aria-label="Close">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          <div className="mb-4 flex justify-center rounded-xl bg-slate-50 py-4">
            <PaarsivIdCard
              size="preview"
              name={emp.name}
              lastName={emp.lastName}
              jobTitle={emp.position || emp.jobTitle || 'Employee'}
              employeeId={emp.employeeId}
              cardNumber={card.cardNumber}
              profilePhoto={emp.profilePhoto || emp.profilePicture}
              userId={emp._id || emp.id}
            />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2.5">
            {[
              ['Card Number', card.cardNumber],
              ['Type', card.cardType],
              ['Status', getCardStatusLabel(cardStatus)],
              ['Issued', card.issueDate ? new Date(card.issueDate).toLocaleDateString() : '—'],
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] text-slate-500">{label}</p>
                <p className="text-sm font-semibold capitalize text-slate-900">{val}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white"
              style={{ background: MINT_GRADIENT }}
            >
              <FiDownload className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdCardGenerator;

