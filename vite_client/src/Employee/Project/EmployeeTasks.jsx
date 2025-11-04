import React, { useState, useEffect } from 'react';
import { 
  FiPlus, 
  FiSave, 
  FiTrash2, 
  FiEdit3, 
  FiCheck, 
  FiClock, 
  FiPause, 
  FiPlay,
  FiArrowLeft,
  FiCalendar,
  FiUser,
  FiMessageSquare
} from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  fetchMyTasks, 
  createNewTask, 
  updateExistingTask 
} from '../../context/employeeTaskSlice';

const EmployeeTasks = () => {
  const { projectId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { myProjects, myTasks, status, error } = useSelector(state => state.employeeTask);
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStatus, setTaskStatus] = useState('Not Started');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [comments, setComments] = useState('');

  const currentProject = myProjects.find(p => p._id === projectId);

  useEffect(() => {
    if (projectId) {
      dispatch(fetchMyTasks({ projectId }));
    }
  }, [projectId, dispatch]);

  const handleCreateTask = async () => {
    if (!taskDescription.trim()) return;

    const taskData = {
      projectId,
      taskDescription: taskDescription.trim(),
      status: taskStatus,
      comments: comments.trim()
    };

    const result = await dispatch(createNewTask(taskData));
    if (result.payload?.success) {
      setTaskDescription('');
      setTaskStatus('Not Started');
      setComments('');
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
    if (result.payload?.success) {
      setEditingTaskId(null);
      setTaskDescription('');
      setTaskStatus('Not Started');
      setComments('');
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

  if (!currentProject) {
    return (
      <div className="min-h-screen bg-gray-50 p-5 ml-64 flex items-center justify-center">
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
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-4 py-2 rounded-lg transition shadow flex items-center gap-2 mx-auto text-sm"
          >
            <FiArrowLeft size={16} />
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-5 ml-64">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow-md p-5 mb-5 border border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <button 
                onClick={() => navigate('/employee/projects')}
                className="border border-blue-500 text-blue-500 hover:bg-blue-50 font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-2 text-sm"
              >
                <FiArrowLeft size={16} />
                Back
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 mb-0.5">
                  {currentProject.name}
                </h1>
                <div className="flex items-center gap-2">
                  <FiCalendar size={14} className="text-gray-500" />
                  <span className="text-gray-600 text-xs">Project Tasks Management</span>
                </div>
              </div>
            </div>
            <div className={`inline-flex items-center px-3 py-1 rounded-lg font-medium text-sm ${
              currentProject.status === 'Completed' ? 'bg-green-100 text-green-800' :
              currentProject.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
              currentProject.status === 'On Hold' ? 'bg-yellow-100 text-yellow-800' : 
              'bg-gray-100 text-gray-800'
            }`}>
              {currentProject.status}
            </div>
          </div>
        </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded-lg mb-4 font-medium text-sm">
          {error}
        </div>
      )}

      {/* Task Input Form */}
      <div className="bg-white rounded-lg shadow-md p-5 mb-5 border border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center">
            {editingTaskId ? <FiEdit3 size={18} className="text-white" /> : <FiPlus size={18} className="text-white" />}
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-0.5">
              {editingTaskId ? 'Update Task' : 'Add New Task'}
            </h2>
            <p className="text-gray-600 text-xs">
              {editingTaskId ? 'Modify your task details' : 'Create a new task for this project'}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none text-sm"
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
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-medium px-4 py-2 rounded-lg transition shadow disabled:shadow-none flex items-center gap-2 text-sm"
            >
              {editingTaskId ? <FiSave size={16} /> : <FiPlus size={16} />}
              {editingTaskId ? 'Update Task' : '+ Add Task'}
            </button>
          </div>
        </div>
      </div>

      {/* Tasks List Section */}
      <div className="bg-white rounded-lg shadow-md p-5 border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-500 rounded-lg flex items-center justify-center">
              <FiCheck size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-0.5">
                My Tasks
              </h2>
              <p className="text-gray-600 text-xs">
                Manage and track your project tasks
              </p>
            </div>
          </div>
          <div className="relative">
            <div className="bg-blue-500 text-white px-3 py-1 rounded-lg font-medium text-sm">
              {myTasks.length} Tasks
            </div>
          </div>
        </div>
        
        {status === 'loading' ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
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
                className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex-1 mr-2 leading-tight">
                    {task.taskDescription}
                  </h3>
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${
                    task.status === 'Completed' ? 'bg-green-100 text-green-800' :
                    task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
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
                      className="w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center justify-center transition shadow-sm hover:shadow-md"
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
      </div>
    </div>
  );
};

export default EmployeeTasks;