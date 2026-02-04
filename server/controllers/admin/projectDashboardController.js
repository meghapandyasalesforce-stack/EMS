import Project from '../../models/project.model.js';
import Task from '../../models/task.model.js';
import ProjectUpdate from '../../models/projectUpdate.model.js';
import Employee from '../../models/employee.model.js';
import logger from '../../helpers/logger.js';
import { sendSuccess, sendError } from '../../helpers/responseHelper.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import { getManagerEmployeeIds } from '../../helpers/managerHelper.js';

/**
 * Get project dashboard statistics
 * GET /api/v1/admin/project/dashboard/statistics
 */
export const getProjectStatistics = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const query = addOrganizationFilter(req, {});

        // Manager filtering
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        if (isManager && req.employee) {
            const managerEmployeeIds = await getManagerEmployeeIds(Employee, organizationId, req.employee);
            query.$or = [
                { projectLeader: req.employee._id },
                { projectMembers: req.employee._id },
                { projectLeader: { $in: managerEmployeeIds } },
                { projectMembers: { $in: managerEmployeeIds } }
            ];
        }

        const projects = await Project.find(query).lean();
        const tasks = await Task.find(addOrganizationFilter(req, {})).lean();

        // Project statistics
        const totalProjects = projects.length;
        const projectsByStatus = {
            pending: projects.filter(p => p.status === 'pending').length,
            'in-progress': projects.filter(p => p.status === 'in-progress').length,
            completed: projects.filter(p => p.status === 'completed').length,
            'on-hold': projects.filter(p => p.status === 'on-hold').length
        };

        const projectsByPriority = {
            low: projects.filter(p => p.priority === 'low').length,
            medium: projects.filter(p => p.priority === 'medium').length,
            high: projects.filter(p => p.priority === 'high').length,
            critical: projects.filter(p => p.priority === 'critical').length
        };

        // Task statistics
        const totalTasks = tasks.length;
        const tasksByStatus = {
            'Not Started': tasks.filter(t => t.status === 'Not Started').length,
            'In Progress': tasks.filter(t => t.status === 'In Progress').length,
            'Completed': tasks.filter(t => t.status === 'Completed').length,
            'On Hold': tasks.filter(t => t.status === 'On Hold').length
        };

        // Completion rate
        const completedProjects = projectsByStatus.completed;
        const completionRate = totalProjects > 0 ? ((completedProjects / totalProjects) * 100).toFixed(2) : 0;

        // Task completion rate
        const completedTasks = tasksByStatus.Completed;
        const taskCompletionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : 0;

        // Overdue projects (end date passed but not completed)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const overdueProjects = projects.filter(p => {
            if (!p.endDate || p.status === 'completed') return false;
            const endDate = new Date(p.endDate);
            endDate.setHours(0, 0, 0, 0);
            return endDate < today;
        }).length;

        // Active team members (unique employees in projects)
        const activeTeamMembers = new Set();
        projects.forEach(p => {
            if (p.projectLeader) activeTeamMembers.add(p.projectLeader.toString());
            if (p.projectMembers && p.projectMembers.length > 0) {
                p.projectMembers.forEach(m => activeTeamMembers.add(m.toString()));
            }
        });

        return sendSuccess(res, {
            projects: {
                total: totalProjects,
                byStatus: projectsByStatus,
                byPriority: projectsByPriority,
                completionRate: parseFloat(completionRate),
                overdue: overdueProjects
            },
            tasks: {
                total: totalTasks,
                byStatus: tasksByStatus,
                completionRate: parseFloat(taskCompletionRate)
            },
            team: {
                activeMembers: activeTeamMembers.size
            }
        }, 'Project statistics retrieved successfully');
    } catch (error) {
        logger.error('Get Project Statistics Error', {
            error: error.message,
            stack: error.stack
        });
        return sendError(res, 'Error fetching project statistics', 500, 'FETCH_ERROR');
    }
};

/**
 * Get project progress tracking
 * GET /api/v1/admin/project/dashboard/progress
 */
export const getProjectProgress = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const { projectId } = req.query;

        const query = addOrganizationFilter(req, {});
        if (projectId) {
            query._id = projectId;
        }

        const projects = await Project.find(query)
            .populate('projectLeader', 'name email')
            .populate('projectMembers', 'name email')
            .lean();

        // Manager filtering
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        let filteredProjects = projects;
        if (isManager && req.employee) {
            const managerEmployeeIds = await getManagerEmployeeIds(Employee, organizationId, req.employee);
            const managerEmployeeIdStrings = managerEmployeeIds.map(id => id.toString());
            filteredProjects = projects.filter(p => {
                const leaderId = p.projectLeader?._id?.toString() || p.projectLeader?.toString();
                const isLeader = leaderId === req.employee._id.toString();
                const isMember = p.projectMembers?.some(m => {
                    const memberId = m._id?.toString() || m.toString();
                    return memberId === req.employee._id.toString();
                });
                const hasTeamMember = leaderId && managerEmployeeIdStrings.includes(leaderId) ||
                    p.projectMembers?.some(m => {
                        const memberId = m._id?.toString() || m.toString();
                        return managerEmployeeIdStrings.includes(memberId);
                    });
                return isLeader || isMember || hasTeamMember;
            });
        }

        // Get project updates for progress tracking
        const projectIds = filteredProjects.map(p => p._id);
        const updates = await ProjectUpdate.find({
            organizationId,
            projectId: { $in: projectIds }
        })
            .sort({ updateDate: -1 })
            .lean();

        // Get tasks for each project
        const tasks = await Task.find({
            organizationId,
            project: { $in: projectIds }
        }).lean();

        // Calculate progress for each project
        const progressData = filteredProjects.map(project => {
            const projectTasks = tasks.filter(t => t.project?.toString() === project._id.toString());
            const completedTasks = projectTasks.filter(t => t.status === 'Completed').length;
            const taskProgress = projectTasks.length > 0 ? (completedTasks / projectTasks.length) * 100 : 0;

            // Get latest update with progress
            const latestUpdate = updates
                .filter(u => u.projectId?.toString() === project._id.toString())
                .sort((a, b) => new Date(b.updateDate) - new Date(a.updateDate))[0];

            const updateProgress = latestUpdate?.progress || 0;

            // Use update progress if available, otherwise task progress
            const overallProgress = latestUpdate ? updateProgress : taskProgress;

            // Calculate days remaining/overdue
            let daysRemaining = null;
            if (project.endDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const endDate = new Date(project.endDate);
                endDate.setHours(0, 0, 0, 0);
                const diffTime = endDate - today;
                daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }

            return {
                projectId: project._id,
                projectName: project.name,
                status: project.status,
                priority: project.priority,
                progress: Math.round(overallProgress),
                taskProgress: Math.round(taskProgress),
                updateProgress: latestUpdate ? Math.round(updateProgress) : null,
                totalTasks: projectTasks.length,
                completedTasks,
                daysRemaining,
                isOverdue: daysRemaining !== null && daysRemaining < 0 && project.status !== 'completed',
                startDate: project.startDate,
                endDate: project.endDate,
                projectLeader: project.projectLeader,
                memberCount: project.projectMembers?.length || 0
            };
        });

        return sendSuccess(res, {
            projects: progressData
        }, 'Project progress retrieved successfully');
    } catch (error) {
        logger.error('Get Project Progress Error', {
            error: error.message,
            stack: error.stack
        });
        return sendError(res, 'Error fetching project progress', 500, 'FETCH_ERROR');
    }
};

/**
 * Get team performance metrics
 * GET /api/v1/admin/project/dashboard/team-performance
 */
export const getTeamPerformance = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const query = addOrganizationFilter(req, {});

        const projects = await Project.find(query)
            .populate('projectLeader', 'name email department')
            .populate('projectMembers', 'name email department')
            .lean();

        const tasks = await Task.find(addOrganizationFilter(req, {})).lean();

        // Group by project leader
        const leaderPerformance = {};
        projects.forEach(project => {
            if (!project.projectLeader) return;

            const leaderId = project.projectLeader._id?.toString() || project.projectLeader.toString();
            if (!leaderPerformance[leaderId]) {
                leaderPerformance[leaderId] = {
                    leader: project.projectLeader,
                    projects: [],
                    totalProjects: 0,
                    completedProjects: 0,
                    inProgressProjects: 0,
                    overdueProjects: 0
                };
            }

            leaderPerformance[leaderId].projects.push(project);
            leaderPerformance[leaderId].totalProjects++;
            if (project.status === 'completed') {
                leaderPerformance[leaderId].completedProjects++;
            } else if (project.status === 'in-progress') {
                leaderPerformance[leaderId].inProgressProjects++;
            }

            // Check if overdue
            if (project.endDate && project.status !== 'completed') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const endDate = new Date(project.endDate);
                endDate.setHours(0, 0, 0, 0);
                if (endDate < today) {
                    leaderPerformance[leaderId].overdueProjects++;
                }
            }
        });

        // Calculate completion rate for each leader
        const performanceMetrics = Object.values(leaderPerformance).map(leader => {
            const completionRate = leader.totalProjects > 0
                ? ((leader.completedProjects / leader.totalProjects) * 100).toFixed(2)
                : 0;

            // Get tasks for leader's projects
            const leaderProjectIds = leader.projects.map(p => p._id.toString());
            const leaderTasks = tasks.filter(t => {
                const taskProjectId = t.project?.toString() || t.project;
                return leaderProjectIds.includes(taskProjectId);
            });
            const completedTasks = leaderTasks.filter(t => t.status === 'Completed').length;
            const taskCompletionRate = leaderTasks.length > 0
                ? ((completedTasks / leaderTasks.length) * 100).toFixed(2)
                : 0;

            return {
                leader: leader.leader,
                metrics: {
                    totalProjects: leader.totalProjects,
                    completedProjects: leader.completedProjects,
                    inProgressProjects: leader.inProgressProjects,
                    overdueProjects: leader.overdueProjects,
                    completionRate: parseFloat(completionRate),
                    totalTasks: leaderTasks.length,
                    completedTasks,
                    taskCompletionRate: parseFloat(taskCompletionRate)
                }
            };
        });

        return sendSuccess(res, {
            teamPerformance: performanceMetrics
        }, 'Team performance metrics retrieved successfully');
    } catch (error) {
        logger.error('Get Team Performance Error', {
            error: error.message,
            stack: error.stack
        });
        return sendError(res, 'Error fetching team performance', 500, 'FETCH_ERROR');
    }
};

/**
 * Get budget vs actual cost analysis (CEO only)
 * GET /api/v1/admin/project/dashboard/budget-analysis
 */
export const getBudgetAnalysis = async (req, res) => {
    try {
        // Check if user is CEO
        const isCEO = req.user?.role === 'admin' || 
            (req.employee && (req.employee.position?.toLowerCase().includes('ceo') || 
                             req.employee.position?.toLowerCase().includes('chief executive')));

        if (!isCEO) {
            return sendError(res, 'Access denied. CEO access required for budget analysis.', 403, 'UNAUTHORIZED');
        }

        const organizationId = getOrganizationId(req);
        const query = addOrganizationFilter(req, {});

        const projects = await Project.find(query)
            .select('name status budget actualCost revenue currency startDate endDate')
            .lean();

        const budgetAnalysis = projects.map(project => {
            const budget = project.budget || 0;
            const actualCost = project.actualCost || 0;
            const revenue = project.revenue || 0;
            const variance = budget - actualCost;
            const variancePercentage = budget > 0 ? ((variance / budget) * 100).toFixed(2) : 0;
            const profit = revenue - actualCost;
            const profitMargin = revenue > 0 ? ((profit / revenue) * 100).toFixed(2) : 0;

            return {
                projectId: project._id,
                projectName: project.name,
                status: project.status,
                budget,
                actualCost,
                revenue,
                variance,
                variancePercentage: parseFloat(variancePercentage),
                profit,
                profitMargin: parseFloat(profitMargin),
                currency: project.currency || 'USD',
                startDate: project.startDate,
                endDate: project.endDate
            };
        });

        const summary = {
            totalBudget: budgetAnalysis.reduce((sum, p) => sum + p.budget, 0),
            totalActualCost: budgetAnalysis.reduce((sum, p) => sum + p.actualCost, 0),
            totalRevenue: budgetAnalysis.reduce((sum, p) => sum + p.revenue, 0),
            totalVariance: budgetAnalysis.reduce((sum, p) => sum + p.variance, 0),
            totalProfit: budgetAnalysis.reduce((sum, p) => sum + p.profit, 0),
            projectsOverBudget: budgetAnalysis.filter(p => p.actualCost > p.budget).length,
            projectsUnderBudget: budgetAnalysis.filter(p => p.actualCost < p.budget).length,
            projectsOnBudget: budgetAnalysis.filter(p => p.actualCost === p.budget).length
        };

        return sendSuccess(res, {
            analysis: budgetAnalysis,
            summary
        }, 'Budget analysis retrieved successfully');
    } catch (error) {
        logger.error('Get Budget Analysis Error', {
            error: error.message,
            stack: error.stack
        });
        return sendError(res, 'Error fetching budget analysis', 500, 'FETCH_ERROR');
    }
};

/**
 * Get comprehensive dashboard data
 * GET /api/v1/admin/project/dashboard
 */
export const getProjectDashboard = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const query = addOrganizationFilter(req, {});

        // Get all data in parallel
        const [projects, tasks, updates] = await Promise.all([
            Project.find(query)
                .populate('projectLeader', 'name email department')
                .populate('projectMembers', 'name email department')
                .lean(),
            Task.find(addOrganizationFilter(req, {})).lean(),
            ProjectUpdate.find(addOrganizationFilter(req, {}))
                .sort({ updateDate: -1 })
                .limit(10)
                .populate('postedBy', 'name email')
                .populate('projectId', 'name')
                .lean()
        ]);

        // Manager filtering
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        let filteredProjects = projects;
        if (isManager && req.employee) {
            const managerEmployeeIds = await getManagerEmployeeIds(Employee, organizationId, req.employee);
            const managerEmployeeIdStrings = managerEmployeeIds.map(id => id.toString());
            filteredProjects = projects.filter(p => {
                const leaderId = p.projectLeader?._id?.toString() || p.projectLeader?.toString();
                return leaderId === req.employee._id.toString() ||
                    p.projectMembers?.some(m => {
                        const memberId = m._id?.toString() || m.toString();
                        return memberId === req.employee._id.toString() || managerEmployeeIdStrings.includes(memberId);
                    }) ||
                    (leaderId && managerEmployeeIdStrings.includes(leaderId));
            });
        }

        // Calculate statistics
        const totalProjects = filteredProjects.length;
        const projectsByStatus = {
            pending: filteredProjects.filter(p => p.status === 'pending').length,
            'in-progress': filteredProjects.filter(p => p.status === 'in-progress').length,
            completed: filteredProjects.filter(p => p.status === 'completed').length,
            'on-hold': filteredProjects.filter(p => p.status === 'on-hold').length
        };

        const projectsByPriority = {
            low: filteredProjects.filter(p => p.priority === 'low').length,
            medium: filteredProjects.filter(p => p.priority === 'medium').length,
            high: filteredProjects.filter(p => p.priority === 'high').length,
            critical: filteredProjects.filter(p => p.priority === 'critical').length
        };

        const totalTasks = tasks.length;
        const tasksByStatus = {
            'Not Started': tasks.filter(t => t.status === 'Not Started').length,
            'In Progress': tasks.filter(t => t.status === 'In Progress').length,
            'Completed': tasks.filter(t => t.status === 'Completed').length,
            'On Hold': tasks.filter(t => t.status === 'On Hold').length
        };

        const completionRate = totalProjects > 0
            ? ((projectsByStatus.completed / totalProjects) * 100).toFixed(2)
            : 0;

        const taskCompletionRate = totalTasks > 0
            ? ((tasksByStatus.Completed / totalTasks) * 100).toFixed(2)
            : 0;

        // Overdue projects
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const overdueProjects = filteredProjects.filter(p => {
            if (!p.endDate || p.status === 'completed') return false;
            const endDate = new Date(p.endDate);
            endDate.setHours(0, 0, 0, 0);
            return endDate < today;
        });

        // Recent updates
        const recentUpdates = updates.slice(0, 5);

        return sendSuccess(res, {
            statistics: {
                projects: {
                    total: totalProjects,
                    byStatus: projectsByStatus,
                    byPriority: projectsByPriority,
                    completionRate: parseFloat(completionRate),
                    overdue: overdueProjects.length
                },
                tasks: {
                    total: totalTasks,
                    byStatus: tasksByStatus,
                    completionRate: parseFloat(taskCompletionRate)
                }
            },
            recentUpdates,
            overdueProjects: overdueProjects.map(p => ({
                projectId: p._id,
                projectName: p.name,
                endDate: p.endDate,
                status: p.status,
                priority: p.priority
            }))
        }, 'Project dashboard data retrieved successfully');
    } catch (error) {
        logger.error('Get Project Dashboard Error', {
            error: error.message,
            stack: error.stack
        });
        return sendError(res, 'Error fetching project dashboard', 500, 'FETCH_ERROR');
    }
};

