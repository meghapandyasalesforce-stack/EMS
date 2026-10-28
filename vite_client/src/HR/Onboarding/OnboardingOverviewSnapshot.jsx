import React, { useMemo } from 'react';
import { FaUser, FaUsers } from 'react-icons/fa';
import { cmInitials } from '../../components/corporateModern';

function personFromField(field) {
    if (!field) return null;
    if (typeof field === 'object') {
        const name = [field.name, field.lastName].filter(Boolean).join(' ').trim()
            || field.email
            || null;
        if (!name) return null;
        return {
            name,
            email: field.email || null,
            role: field.jobTitle || field.position || null,
        };
    }
    return { name: String(field), email: null, role: null };
}

/**
 * Overview right rail — Onboarding Squad (display-only UI matching dossier mock).
 * Uses existing assignedHR / assignedManager / assignedBuddy fields only.
 */
export default function OnboardingOverviewSnapshot({ wf }) {
    const hireFirst = useMemo(() => {
        const emp = wf?.employeeId;
        if (!emp) return 'this hire';
        if (typeof emp === 'object') return emp.name || emp.firstName || 'this hire';
        return 'this hire';
    }, [wf?.employeeId]);

    const squad = useMemo(() => {
        const items = [];
        const buddy = personFromField(wf.assignedBuddy);
        if (buddy) {
            items.push({
                id: 'buddy',
                ...buddy,
                title: buddy.role || 'Onboarding Buddy',
                badge: 'Buddy',
                badgeClass: 'cm-squad-badge cm-squad-badge--buddy',
            });
        }
        const manager = personFromField(wf.assignedManager);
        if (manager) {
            items.push({
                id: 'manager',
                ...manager,
                title: manager.role || 'Hiring Manager',
                badge: 'Manager',
                badgeClass: 'cm-squad-badge cm-squad-badge--manager',
            });
        }
        const hr = personFromField(wf.assignedHR);
        if (hr) {
            items.push({
                id: 'hr',
                ...hr,
                title: hr.role || 'HR Business Partner',
                badge: 'People Partner',
                badgeClass: 'cm-squad-badge cm-squad-badge--hr',
                note: 'Direct Escalation Lead',
            });
        }
        return items;
    }, [wf.assignedHR, wf.assignedManager, wf.assignedBuddy]);

    return (
        <div className="cm-card cm-onboarding-squad h-full flex flex-col">
            <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold tracking-tight text-[var(--cm-on-surface)] mb-0">
                    Onboarding Squad
                </h2>
                <FaUsers className="text-[var(--cm-muted)] opacity-70" aria-hidden />
            </div>
            <p className="mb-4 text-sm leading-snug text-[var(--cm-muted)]">
                Primary contacts assigned to guide {hireFirst}
            </p>

            {squad.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[rgba(187,202,193,0.55)] px-4 py-6 text-center">
                    <FaUser className="mx-auto mb-2 text-[var(--cm-muted)] opacity-60" />
                    <p className="text-sm text-[var(--cm-muted)]">
                        No HR, manager, or buddy assigned yet.
                    </p>
                </div>
            ) : (
                <ul className="cm-onboarding-squad__list flex-1">
                    {squad.map((member) => (
                        <li key={member.id} className="cm-onboarding-squad__item">
                            <div className="flex items-start gap-3">
                                <div className="cm-onboarding-squad__avatar" aria-hidden>
                                    {cmInitials(member.name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-bold text-[var(--cm-on-surface)] truncate">
                                            {member.name}
                                        </p>
                                        <span className={member.badgeClass}>{member.badge}</span>
                                    </div>
                                    <p className="text-xs text-[var(--cm-muted)] truncate">{member.title}</p>
                                    {member.note && (
                                        <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-[var(--cm-primary-deep)]">
                                            {member.note}
                                        </p>
                                    )}
                                    {member.email && !member.note && (
                                        <p className="mt-0.5 truncate text-[11px] text-[var(--cm-outline)]">
                                            {member.email}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
