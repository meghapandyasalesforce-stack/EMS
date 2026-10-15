import { useState, useEffect } from 'react';
import { FaTrash, FaEdit, FaCheck, FaTimes, FaPlus } from 'react-icons/fa';

const Todo = ({ variant = 'default' }) => {
  const workspace = variant === 'workspace';
  const [todos, setTodos] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [storageStatus, setStorageStatus] = useState('Initializing...');

  // Enhanced localStorage initialization
  useEffect(() => {
    const initializeTodos = () => {
      try {
        setStorageStatus('Loading todos...');
        const savedTodos = localStorage.getItem('todos');
        
        
        if (savedTodos) {
          const parsed = JSON.parse(savedTodos);
          if (Array.isArray(parsed)) {
            setTodos(parsed);
            setStorageStatus('Todos loaded successfully');
          } else {
            // Removed console.warn for production
            localStorage.removeItem('todos');
            setStorageStatus('Reset invalid todo data');
          }
        } else {
          setStorageStatus('No saved todos found');
        }
      } catch (error) {
        // Removed console.error for production
        setStorageStatus(`Error: ${error.message}`);
        localStorage.removeItem('todos');
      }
    };

    // Test if localStorage is available
    const testLocalStorage = () => {
      try {
        const testKey = `test_${Date.now()}`;
        localStorage.setItem(testKey, 'test_value');
        localStorage.removeItem(testKey);
        initializeTodos();
      } catch (e) {
        // Removed console.error for production
        setStorageStatus('localStorage not available - using in-memory storage');
      }
    };

    testLocalStorage();
  }, []);

  // Save todos with error handling
  useEffect(() => {
    if (todos.length === 0 && storageStatus.includes('Initializing')) {
      return; // Skip initial empty save
    }

    try {
      localStorage.setItem('todos', JSON.stringify(todos));
      setStorageStatus(`Saved ${todos.length} todos`);
    } catch (error) {
      // Removed console.error for production
      setStorageStatus(`Save failed: ${error.message}`);
    }
  }, [todos]);

  const addTodo = () => {
    if (inputValue.trim() === '') return;
    
    const newTodo = {
      id: Date.now(),
      text: inputValue,
      completed: false
    };
    
    setTodos(prev => [...prev, newTodo]);
    setInputValue('');
  };

  const deleteTodo = (id) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  };

  const toggleComplete = (id) => {
    setTodos(prev =>
      prev.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const startEditing = (id, text) => {
    setEditingId(id);
    setEditValue(text);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveEdit = (id) => {
    if (editValue.trim() === '') {
      cancelEditing();
      return;
    }
    
    setTodos(prev =>
      prev.map(todo =>
        todo.id === id ? { ...todo, text: editValue } : todo
      )
    );
    setEditingId(null);
    setEditValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      addTodo();
    }
  };

  const clearAllTodos = () => {
    if (window.confirm('Are you sure you want to delete all todos?')) {
      setTodos([]);
      localStorage.removeItem('todos');
      setStorageStatus('All todos cleared');
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:gap-0">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a new task..."
          className={`w-full min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 sm:rounded-r-none ${
            workspace ? 'focus:ring-[#20C997]' : 'focus:ring-orange-500'
          }`}
        />
        <button
          onClick={addTodo}
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white transition-all duration-200 sm:w-auto sm:rounded-l-none sm:px-6 sm:text-base ${
            workspace
              ? 'bg-[#20C997] hover:bg-[#1ab589]'
              : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
          }`}
        >
          <FaPlus className="w-4 h-4" /> Add Task
        </button>
      </div>
      
      {/* Todo List */}
      <ul className="space-y-3">
        {todos.length === 0 ? (
          <li className="rounded-xl border-2 border-dashed border-gray-200 bg-[#F8F9FB] py-6 text-center text-gray-500">
            <div className="text-lg font-medium mb-2">All caught up!</div>
            <div className="text-sm">Add a task when you need a reminder.</div>
          </li>
        ) : (
          todos.map(todo => (
            <li 
              key={todo.id}
              className={`flex items-center justify-between rounded-lg border p-3 transition-all duration-200 hover:shadow-md sm:p-4 ${
                todo.completed
                  ? 'bg-gray-50 border-gray-200'
                  : workspace
                    ? 'bg-white border-gray-200 hover:border-[#20C997]/40'
                    : 'bg-white border-gray-300 hover:border-orange-300'
              }`}
            >
              {editingId === todo.id ? (
                <div className="flex w-full items-center">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(todo.id)}
                    className="mr-2 min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    autoFocus
                  />
                  <div className="flex shrink-0 space-x-1">
                    <button
                      onClick={() => saveEdit(todo.id)}
                      className="text-green-500 hover:text-theme-primary p-1"
                      title="Save"
                    >
                      <FaCheck />
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Cancel"
                    >
                      <FaTimes />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex w-full items-start gap-2 sm:items-center">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => toggleComplete(todo.id)}
                    className={`mt-1 h-5 w-5 shrink-0 rounded sm:mt-0 ${
                      workspace
                        ? 'text-[#20C997] focus:ring-[#20C997]'
                        : 'text-orange-500 focus:ring-orange-500'
                    }`}
                  />
                  <span 
                    className={`min-w-0 flex-1 break-words pr-1 text-sm sm:text-base md:text-lg ${
                      todo.completed ? 'line-through text-gray-500' : 'text-gray-800'
                    }`}
                  >
                    {todo.text}
                  </span>
                  <div className="ml-0 flex shrink-0 items-center space-x-1 sm:ml-3 sm:space-x-2">
                    <button
                      onClick={() => startEditing(todo.id, todo.text)}
                      className={
                        workspace
                          ? 'text-[#20C997] hover:text-[#006D4E] rounded-lg p-1.5 transition-colors hover:bg-[#20C997]/10 sm:p-2'
                          : 'text-orange-500 hover:text-orange-700 rounded-lg p-1.5 transition-colors hover:bg-orange-50 sm:p-2'
                      }
                      title="Edit"
                    >
                      <FaEdit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 sm:p-2"
                      title="Delete"
                    >
                      <FaTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default Todo;
