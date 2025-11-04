import { useState, useEffect } from 'react';
import { FaTrash, FaEdit, FaCheck, FaTimes, FaPlus } from 'react-icons/fa';

const Todo = () => {
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
            console.warn('Invalid todos format - resetting');
            localStorage.removeItem('todos');
            setStorageStatus('Reset invalid todo data');
          }
        } else {
          setStorageStatus('No saved todos found');
        }
      } catch (error) {
        console.error('Initialization error:', error);
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
        console.error('localStorage unavailable:', e);
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
      console.error('Save error:', error);
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
      <div className="flex mb-6">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a new task..."
          className="flex-1 px-4 py-3 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
        <button
          onClick={addTodo}
          className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-3 rounded-r-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-200 flex items-center gap-2 font-medium"
        >
          <FaPlus className="w-4 h-4" /> Add Task
        </button>
      </div>
      
      {/* Todo List */}
      <ul className="space-y-3">
        {todos.length === 0 ? (
          <li className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
            <div className="text-lg font-medium mb-2">No tasks yet</div>
            <div className="text-sm">Add your first task above!</div>
          </li>
        ) : (
          todos.map(todo => (
            <li 
              key={todo.id}
              className={`flex items-center justify-between p-4 border rounded-lg transition-all duration-200 hover:shadow-md ${
                todo.completed ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300 hover:border-orange-300'
              }`}
            >
              {editingId === todo.id ? (
                <div className="flex items-center w-full">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(todo.id)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded-md mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <div className="flex space-x-1">
                    <button
                      onClick={() => saveEdit(todo.id)}
                      className="text-green-500 hover:text-green-700 p-1"
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
                <div className="flex items-center w-full">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => toggleComplete(todo.id)}
                    className="h-5 w-5 text-orange-500 rounded mr-4 flex-shrink-0 focus:ring-orange-500"
                  />
                  <span 
                    className={`flex-1 break-words text-lg ${
                      todo.completed ? 'line-through text-gray-500' : 'text-gray-800'
                    }`}
                  >
                    {todo.text}
                  </span>
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => startEditing(todo.id, todo.text)}
                      className="text-orange-500 hover:text-orange-700 p-2 rounded-lg hover:bg-orange-50 transition-colors"
                      title="Edit"
                    >
                      <FaEdit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
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