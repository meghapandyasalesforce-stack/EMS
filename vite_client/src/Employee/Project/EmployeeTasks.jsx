import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FiPlus, 
  FiSave, 
  FiEdit3, 
  FiCheck, 
  FiClock, 
  FiPause, 
  FiPlay,
  FiArrowLeft,
  FiCalendar,
  FiUser,
  FiMessageSquare,
  FiClipboard
} from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  fetchMyProjects,
  fetchMyTasks, 
  createNewTask, 
  updateExistingTask,
  fetchEmployeeWorkPlan,
  updateEmployeeWorkItem,
  addEmployeeWorkItemComment,
} from '../../context/employeeTaskSlice';

const projectStatusDisplay = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'completed') return { label: 'Completed', className: 'bg-theme-primary/10 text-theme-primary' };
  if (s === 'in-progress') return { label: 'In Progress', className: 'bg-theme-secondary/10 text-theme-secondary' };
  if (s === 'on-hold') return { label: 'On Hold', className: 'bg-yellow-100 text-yellow-800' };
  if (s === 'pending') return { label: 'Pending', className: 'bg-gray-100 text-gray-800' };
  return { label: status || 'Active', className: 'bg-gray-100 text-gray-800' };
};
import EmployeeWorkPlanSection from './EmployeeWorkPlanSection';

const EmployeeTasks = () => {
  const { projectId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const {
    myProjects,
    myTasks,
    workPlan,
    workPlanProgress,
    workPlanStatus,
    workPlanError,
    status,
    error,
  } = useSelector((state) => state.employeeTask);
  const employee = useSelector(
    (state) => state.employeeDetails?.employee || state.auth?.user
  );
  const [activeTab, setActiveTab] = useState('plan');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStatus, setTaskStatus] = useState('Not Started');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [comments, setComments] = useState('');
  const [updatingWorkItemId, setUpdatingWorkItemId] = useState(null);
  const [commentingWorkItemId, setCommentingWorkItemId] = useState(null);
  const [projectsLoaded, setProjectsLoaded] = useState(false);

  const currentProject = useMemo(
    () => myProjects.find((p) => String(p._id) === String(projectId)),
    [myProjects, projectId]
  );

  const projectStatus = useMemo(
    () => projectStatusDisplay(currentProject?.status),
    [currentProject?.status]
  );

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      await dispatch(fetchMyProjects());
      if (!cancelled) setProjectsLoaded(true);
    })();
    dispatch(fetchMyTasks({ projectId }));
    dispatch(fetchEmployeeWorkPlan(projectId));
    return () => {
      cancelled = true;
    };
  }, [projectId, dispatch]);

  const handleWorkItemStatusChange = useCallback(
    async (workItemId, newStatus) => {
      setUpdatingWorkItemId(workItemId);
      await dispatch(updateEmployeeWorkItem(workItemId, projectId, { status: newStatus }));
      setUpdatingWorkItemId(null);
    },
    [dispatch, projectId]
  );

  const handleWorkItemDueDateChange = useCallback(
    async (workItemId, dueDate, dueDateChangeReason) => {
      setUpdatingWorkItemId(workItemId);
      const result = await dispatch(
        updateEmployeeWorkItem(workItemId, projectId, {
          dueDate,
          dueDateChangeReason,
        })
      );
      setUpdatingWorkItemId(null);
      return result?.success;
    },
    [dispatch, projectId]
  );

  const handleWorkItemComment = useCallback(
    async (workItemId, text) => {
      setCommentingWorkItemId(workItemId);
      const result = await dispatch(addEmployeeWorkItemComment(workItemId, projectId, text));
      setCommentingWorkItemId(null);
      return result?.success;
    },
    [dispatch, projectId]
  );

  const handleCreateTask = async () => {
    if (!taskDescription.trim()) return;

    const taskData = {
      projectId,
      taskDescription: taskDescription.trim(),
      status: taskStatus,
      comments: comments.trim()
    };

    const result = await dispatch(createNewTask(taskData));
    if (result?.success) {
      setTaskDescription('');
      setTaskStatus('Not Started');
      setComments('');
      dispatch(fetchMyTasks({ projectId }));
    }
  };

  const handleUpdateTask = async (taskId) => {
    if (!taskDescription.trim()) return;

    const updateData = {
      taskDescription: taskDescription.trim(),
      status: taskStatus,
      comments: comments.trim()
    };

    const result = await dispatch(updateExistingTask(taskId, updateData));
    if (result?.success) {
      setEditingTaskId(null);
      setTaskDescription('');
      setTaskStatus('Not Started');
      setComments('');
      dispatch(fetchMyTasks({ projectId }));
    }
  };

  const handleEditTask = (task) => {
    setEditingTaskId(task._id);
    setTaskDescription(task.taskDescription);
    setTaskStatus(task.status);
    setComments(task.comments || '');
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setTaskDescription('');
    setTaskStatus('Not Started');
    setComments('');
  };

  if (!projectsLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-5 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-theme-secondary" />
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-5 transition-all duration-300 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 text-center max-w-md w-full border border-gray-200">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiUser size={28} className="text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Project Not Found
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            The project you're looking for doesn't exist or you don't have access to it.
          </p>
          <button 
            onClick={() => navigate('/employee/projects')} 
            className="bg-theme-secondary hover:bg-theme-primary text-white font-medium px-4 py-2 rounded-lg transition shadow flex items-center gap-2 mx-auto text-sm"
          >
            <FiArrowLeft size={16} />
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-5 transition-all duration-300">
      <div className="w-full max-w-[1600px] mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-5 mb-5 border border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <button 
                onClick={() => navigate('/employee/projects')}
                className="border border-theme-secondary text-theme-secondary hover:bg-theme-secondary/10 font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-2 text-sm"
              >
                <FiArrowLeft size={16} />
                Back
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 mb-0.5">
                  {currentProject.name}
                </h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <FiCalendar size={14} className="text-gray-500" />
                  <span className="text-gray-600 text-xs">
                    {currentProject.progress != null
                      ? `Progress ${currentProject.progress}%`
                      : 'Project workspace'}
                  </span>
                </div>
              </div>
            </div>
            <div className={`inline-flex items-center px-3 py-1 rounded-lg font-medium text-sm ${projectStatus.className}`}>
              {projectStatus.label}
            </div>
          </div>
        </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded-lg mb-4 font-medium text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-5 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('plan')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition flex items-center gap-2 ${
            activeTab === 'plan'
              ? 'border-theme-secondary text-theme-secondary'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <FiClipboard size={16} />
          Work plan
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition flex items-center gap-2 ${
            activeTab === 'daily'
              ? 'border-theme-secondary text-theme-secondary'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <FiMessageSquare size={16} />
          Today&apos;s log
        </button>
      </div>

      {activeTab === 'plan' && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-5 mb-5 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-theme-primary rounded-lg flex items-center justify-center">
              <FiClipboard size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Project work plan</h2>
              <p className="text-gray-600 text-xs">
                Tasks from your manager — update items assigned to you or under your assigned tasks
              </p>
            </div>
          </div>
          <EmployeeWorkPlanSection
            workPlan={workPlan}
            workPlanProgress={workPlanProgress}
            workPlanStatus={workPlanStatus}
            workPlanError={workPlanError}
            currentEmployeeId={employee?._id}
            onStatusChange={handleWorkItemStatusChange}
            onDueDateChange={handleWorkItemDueDateChange}
            updatingId={updatingWorkItemId}
            onAddComment={handleWorkItemComment}
            commentingId={commentingWorkItemId}
            canComment={Boolean(employee?._id)}
          />
        </div>
      )}

      {activeTab === 'daily' && (
        <>
      {/* Task Input Form */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-5 mb-5 border border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-theme-secondary rounded-lg flex items-center justify-center">
            {editingTaskId ? <FiEdit3 size={18} className="text-white" /> : <FiPlus size={18} className="text-white" />}
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-0.5">
              {editingTaskId ? 'Update log' : 'Today&apos;s work log'}
            </h2>
            <p className="text-gray-600 text-xs">
              {editingTaskId
                ? 'Modify what you logged for today'
                : 'Record what you worked on today (separate from the work plan)'}
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Task Description
            </label>
            <input
              type="text"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary transition text-sm"
              placeholder="Describe what needs to be done..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Status
            </label>
            <select
              value={taskStatus}
              onChange={(e) => setTaskStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary transition text-sm"
            >
              <option value="Not Started">
                <div className="flex items-center gap-2">
                  <FiClock size={16} />
                  Not Started
                </div>
              </option>
              <option value="In Progress">
                <div className="flex items-center gap-2">
                  <FiPlay size={16} />
                  In Progress
                </div>
              </option>
              <option value="Completed">
                <div className="flex items-center gap-2">
                  <FiCheck size={16} />
                  Completed
                </div>
              </option>
              <option value="On Hold">
                <div className="flex items-center gap-2">
                  <FiPause size={16} />
                  On Hold
                </div>
              </option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Comments (Optional)
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary transition resize-none text-sm"
              placeholder="Add any additional notes or comments..."
            />
          </div>

          <div className="lg:col-span-2 flex justify-end gap-3 mt-3">
            {editingTaskId && (
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-50 font-medium rounded-lg transition text-sm"
              >
                Cancel
              </button>
            )}
            <button
              onClick={editingTaskId ? 
                () => handleUpdateTask(editingTaskId) : 
                handleCreateTask}
              disabled={!taskDescription.trim() || status === 'loading'}
              className="bg-theme-secondary hover:bg-theme-primary disabled:bg-gray-300 text-white font-medium px-4 py-2 rounded-lg transition shadow disabled:shadow-none flex items-center gap-2 text-sm"
            >
              {editingTaskId ? <FiSave size={16} /> : <FiPlus size={16} />}
              {editingTaskId ? 'Update Task' : '+ Add Task'}
            </button>
          </div>
        </div>
      </div>

      {/* Tasks List Section */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-5 border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-theme-primary rounded-lg flex items-center justify-center">
              <FiCheck size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-0.5">
                My daily logs
              </h2>
              <p className="text-gray-600 text-xs">
                Your per-day entries for this project
              </p>
            </div>
          </div>
          <div className="relative">
            <div className="bg-theme-secondary text-white px-3 py-1 rounded-lg font-medium text-sm">
              {myTasks.length} Tasks
            </div>
          </div>
        </div>
        
        {status === 'loading' ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-theme-secondary"></div>
          </div>
        ) : myTasks.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <FiMessageSquare size={40} className="text-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-600 mb-1">
              No tasks found
            </h3>
            <p className="text-sm text-gray-500">
              Start by adding your first task above
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myTasks.map((task) => (
              <div 
                key={task._id}
                className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md hover:border-theme-secondary transition"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex-1 mr-2 leading-tight">
                    {task.taskDescription}
                  </h3>
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${
                    task.status === 'Completed' ? 'bg-theme-primary/10 text-theme-primary' :
                    task.status === 'In Progress' ? 'bg-theme-secondary/10 text-theme-secondary' :
                    task.status === 'On Hold' ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {task.status}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <FiCalendar size={14} className="text-gray-500" />
                  <span className="text-xs text-gray-600">
                    {new Date(task.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                
                {task.comments && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
                    <p className="text-xs text-gray-600 italic leading-relaxed">
                      "{task.comments}"
                    </p>
                  </div>
                )}
                
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleEditTask(task)}
                      className="w-8 h-8 bg-theme-secondary hover:bg-theme-primary text-white rounded-lg flex items-center justify-center transition shadow-sm hover:shadow-md"
                      title="Edit Task"
                    >
                      <FiEdit3 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}
      </div>
    </div>
  );
};

export default EmployeeTasks;