import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import './TodoPage.css'

const FILTERS = ['todas', 'activas', 'completadas']

export default function TodoPage({ session }) {
  const [todos, setTodos] = useState([])
  const [input, setInput] = useState('')
  const [filter, setFilter] = useState('todas')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const user = session.user

  const fetchTodos = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (!error) setTodos(data || [])
    setLoading(false)
  }, [user.id])

  useEffect(() => { fetchTodos() }, [fetchTodos])

  const filteredTodos = todos.filter(t => {
    if (filter === 'activas') return !t.completed
    if (filter === 'completadas') return t.completed
    return true
  })

  const activeCount = todos.filter(t => !t.completed).length

  const addTodo = async () => {
    const trimmed = input.trim()
    if (!trimmed) { setError('La tarea no puede estar vacía.'); return }
    if (trimmed.length < 3) { setError('Mínimo 3 caracteres.'); return }

    const newTodo = { text: trimmed, completed: false, user_id: user.id }
    // Optimistic update
    const tempId = 'temp-' + Date.now()
    setTodos(prev => [...prev, { ...newTodo, id: tempId, created_at: new Date().toISOString() }])
    setInput('')
    setError('')

    const { data, error } = await supabase.from('todos').insert(newTodo).select().single()
    if (error) {
      setTodos(prev => prev.filter(t => t.id !== tempId))
      setError('Error al guardar la tarea.')
    } else {
      setTodos(prev => prev.map(t => t.id === tempId ? data : t))
    }
  }

  const toggleTodo = async (todo) => {
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, completed: !t.completed } : t))
    await supabase.from('todos').update({ completed: !todo.completed }).eq('id', todo.id)
  }

  const deleteTodo = async (id) => {
    setTodos(prev => prev.filter(t => t.id !== id))
    await supabase.from('todos').delete().eq('id', id)
  }

  const saveEdit = async (id) => {
    const trimmed = editText.trim()
    if (!trimmed) return
    setTodos(prev => prev.map(t => t.id === id ? { ...t, text: trimmed } : t))
    setEditingId(null)
    await supabase.from('todos').update({ text: trimmed }).eq('id', id)
  }

  const clearCompleted = async () => {
    const completedIds = todos.filter(t => t.completed).map(t => t.id)
    setTodos(prev => prev.filter(t => !t.completed))
    await supabase.from('todos').delete().in('id', completedIds)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="todo-page">
      <div className="todo-container">
        {/* Navbar */}
        <nav className="todo-nav" data-cy="navbar">
          <div className="nav-brand">
            <div className="nav-dot" />
            <span>TaskFlow</span>
          </div>
          <div className="nav-user">
            <span className="user-email" data-cy="user-email">{user.email}</span>
            <button className="logout-btn" onClick={handleLogout} data-cy="logout-btn">
              Salir →
            </button>
          </div>
        </nav>

        {/* Header */}
        <header className="todo-header">
          <h1 className="todo-title" data-cy="todo-page-title">Mis tareas</h1>
          <p className="todo-greeting">
            {activeCount === 0 ? '¡Todo al día! 🎉' : `Tienes `}
            {activeCount > 0 && <><strong data-cy="active-count">{activeCount}</strong> pendiente{activeCount !== 1 ? 's' : ''}</>}
          </p>
        </header>

        {/* Input */}
        <div className="input-section">
          <div className="input-wrapper">
            <input
              type="text"
              className="todo-input"
              placeholder="Añadir nueva tarea..."
              value={input}
              onChange={e => { setInput(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && addTodo()}
              data-cy="todo-input"
              maxLength={120}
            />
            <button className="add-btn" onClick={addTodo} data-cy="add-btn">Añadir</button>
          </div>
          {error && <p className="input-error" data-cy="error-message">{error}</p>}
        </div>

        {/* Filters */}
        <div className="filters" data-cy="filters">
          {FILTERS.map(f => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
              data-cy={`filter-${f}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          {todos.some(t => t.completed) && (
            <button className="clear-btn" onClick={clearCompleted} data-cy="clear-completed">
              Limpiar completadas
            </button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="list-loading" data-cy="list-loading">
            <div className="spinner" />
            <span>Cargando tareas...</span>
          </div>
        ) : (
          <ul className="todo-list" data-cy="todo-list">
            {filteredTodos.length === 0 && (
              <li className="empty-state" data-cy="empty-state">
                {filter === 'completadas' ? '¡Aún no has completado ninguna tarea!' :
                 filter === 'activas' ? 'No hay tareas pendientes.' :
                 'Añade tu primera tarea arriba.'}
              </li>
            )}
            {filteredTodos.map(todo => (
              <li
                key={todo.id}
                className={`todo-item ${todo.completed ? 'completed' : ''}`}
                data-cy="todo-item"
                data-completed={todo.completed}
              >
                {editingId === todo.id ? (
                  <div className="edit-wrapper">
                    <input
                      className="edit-input"
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit(todo.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      autoFocus
                      data-cy="edit-input"
                    />
                    <button className="save-btn" onClick={() => saveEdit(todo.id)} data-cy="save-edit-btn">✓</button>
                    <button className="cancel-btn" onClick={() => setEditingId(null)} data-cy="cancel-edit-btn">✕</button>
                  </div>
                ) : (
                  <>
                    <button
                      className={`check-btn ${todo.completed ? 'checked' : ''}`}
                      onClick={() => toggleTodo(todo)}
                      data-cy="toggle-btn"
                    >
                      {todo.completed && '✓'}
                    </button>
                    <span
                      className="todo-text"
                      onDoubleClick={() => { setEditingId(todo.id); setEditText(todo.text) }}
                      data-cy="todo-text"
                    >
                      {todo.text}
                    </span>
                    <div className="todo-actions">
                      <button
                        className="edit-btn"
                        onClick={() => { setEditingId(todo.id); setEditText(todo.text) }}
                        data-cy="edit-btn"
                      >✎</button>
                      <button
                        className="delete-btn"
                        onClick={() => deleteTodo(todo.id)}
                        data-cy="delete-btn"
                      >✕</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
