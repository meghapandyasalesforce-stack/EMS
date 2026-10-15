import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ReportsSidebar from './components/ReportsSidebar';
import LoadingSpinner from '../../components/LoadingSpinner';

const HeadcountReport = lazy(() => import('./pages/HeadcountReport'));
const AttritionReport = lazy(() => import('./pages/AttritionReport'));
const PayrollReport = lazy(() => import('./pages/PayrollReport'));
const AttendanceReport = lazy(() => import('./pages/AttendanceReport'));
const PerformanceReport = lazy(() => import('./pages/PerformanceReport'));
const RecruitmentReport = lazy(() => import('./pages/RecruitmentReport'));
const ComplianceReport = lazy(() => import('./pages/ComplianceReport'));

const HRReportsLayout = () => (
    <div className="flex flex-col items-stretch bg-[#F5F7FB] lg:flex-row lg:items-start">
        <ReportsSidebar />
        <main className="min-w-0 flex-1 p-3 sm:p-4 md:p-5 lg:p-6">
            <Suspense fallback={<LoadingSpinner message="Loading report..." />}>
                <Routes>
                    <Route index element={<Navigate to="headcount" replace />} />
                    <Route path="headcount" element={<HeadcountReport />} />
                    <Route path="attrition" element={<AttritionReport />} />
                    <Route path="payroll" element={<PayrollReport />} />
                    <Route path="attendance" element={<AttendanceReport />} />
                    <Route path="performance" element={<PerformanceReport />} />
                    <Route path="recruitment" element={<RecruitmentReport />} />
                    <Route path="compliance" element={<ComplianceReport />} />
                    <Route path="*" element={<Navigate to="headcount" replace />} />
                </Routes>
            </Suspense>
        </main>
    </div>
);

export default HRReportsLayout;
