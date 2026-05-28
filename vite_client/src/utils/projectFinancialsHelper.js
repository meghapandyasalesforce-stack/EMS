/**
 * Aligns with server projectController isCEO() — who can see/edit budget, revenue, cost.
 */
export function canViewProjectFinancials(user, employee) {
  if (user?.role === 'admin') return true;
  const position = (user?.position || employee?.position || '').toLowerCase().trim();
  return position === 'ceo' || position.includes('chief executive');
}

export function parseProjectFinancial(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function sumProjectFinancials(projects) {
  if (!Array.isArray(projects)) {
    return { totalBudget: 0, totalRevenue: 0, totalCost: 0 };
  }
  return projects.reduce(
    (acc, project) => {
      acc.totalBudget += parseProjectFinancial(project.budget);
      acc.totalRevenue += parseProjectFinancial(project.revenue);
      acc.totalCost += parseProjectFinancial(project.actualCost);
      return acc;
    },
    { totalBudget: 0, totalRevenue: 0, totalCost: 0 }
  );
}

export function projectFinancialPayload(form) {
  return {
    budget: parseProjectFinancial(form.budget),
    actualCost: parseProjectFinancial(form.actualCost),
    revenue: parseProjectFinancial(form.revenue),
    currency: form.currency || 'USD',
  };
}
