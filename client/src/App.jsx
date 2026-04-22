import { startTransition, useEffect, useMemo, useState } from 'react';
import { createTask, deleteTask, fetchTasks, updateTask } from './api';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' }
];

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function App() {
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [filter, setFilter] = useState('all');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadTasks() {
      try {
        const data = await fetchTasks();
        if (!isMounted) {
          return;
        }

        startTransition(() => {
          setTasks(data.tasks);
        });
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTasks();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredTasks = useMemo(() => {
    if (filter === 'completed') {
      return tasks.filter((task) => task.completed);
    }

    if (filter === 'pending') {
      return tasks.filter((task) => !task.completed);
    }

    return tasks;
  }, [filter, tasks]);

  const taskCounts = useMemo(() => {
    const completed = tasks.filter((task) => task.completed).length;
    return {
      all: tasks.length,
      completed,
      pending: tasks.length - completed
    };
  }, [tasks]);

  async function handleCreateTask(event) {
    event.preventDefault();

    const title = newTaskTitle.trim();
    if (!title) {
      setErrorMessage('Please enter a task title before adding it.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');
      const data = await createTask({ title });
      setTasks((currentTasks) => [data.task, ...currentTasks]);
      setNewTaskTitle('');
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function beginEdit(task) {
    setEditingTaskId(task.id);
    setEditingTaskTitle(task.title);
  }

  function cancelEdit() {
    setEditingTaskId(null);
    setEditingTaskTitle('');
  }

  async function handleSaveEdit(taskId) {
    const title = editingTaskTitle.trim();
    if (!title) {
      setErrorMessage('Task title cannot be empty.');
      return;
    }

    try {
      setErrorMessage('');
      const data = await updateTask(taskId, { title });
      setTasks((currentTasks) =>
        currentTasks.map((task) => (task.id === taskId ? data.task : task))
      );
      cancelEdit();
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleToggleTask(task) {
    try {
      setErrorMessage('');
      const data = await updateTask(task.id, {
        completed: !task.completed
      });

      setTasks((currentTasks) =>
        currentTasks.map((currentTask) =>
          currentTask.id === task.id ? data.task : currentTask
        )
      );
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleDeleteTask(taskId) {
    try {
      setErrorMessage('');
      await deleteTask(taskId);
      setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
      if (editingTaskId === taskId) {
        cancelEdit();
      }
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  return (
    <div className="app-shell">
      <main className="app">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Task Manager</p>
            <h1>Plan, track, and finish tasks.</h1>
            <p className="hero-text">
              A simple task manager for adding work, updating progress, and keeping
              everything in one place.
            </p>
          </div>

          <div className="hero-stats" aria-label="Task overview">
            <article>
              <span>Total</span>
              <strong>{taskCounts.all}</strong>
            </article>
            <article>
              <span>Open</span>
              <strong>{taskCounts.pending}</strong>
            </article>
            <article>
              <span>Completed</span>
              <strong>{taskCounts.completed}</strong>
            </article>
          </div>
        </section>

        <section className="workspace">
          <form className="task-form" onSubmit={handleCreateTask}>
            <label htmlFor="task-title" className="sr-only">
              Add a new task
            </label>
            <input
              id="task-title"
              name="task-title"
              type="text"
              placeholder="Add a new task..."
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              disabled={isSubmitting}
            />
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add task'}
            </button>
          </form>

          <div className="toolbar">
            <div className="filter-group" role="tablist" aria-label="Task filters">
              {FILTERS.map((filterOption) => (
                <button
                  key={filterOption.value}
                  type="button"
                  className={filter === filterOption.value ? 'active' : ''}
                  onClick={() => setFilter(filterOption.value)}
                >
                  {filterOption.label}
                </button>
              ))}
            </div>
            <p className="toolbar-copy">
              Showing {filteredTasks.length} task{filteredTasks.length === 1 ? '' : 's'}
            </p>
          </div>

          {errorMessage ? <p className="status error">{errorMessage}</p> : null}
          {isLoading ? <p className="status">Loading tasks...</p> : null}

          {!isLoading && filteredTasks.length === 0 ? (
            <section className="empty-state">
              <h2>No tasks here yet.</h2>
              <p>
                Add a new task above or switch filters to review what is already in
                progress.
              </p>
            </section>
          ) : null}

          <section className="task-list" aria-live="polite">
            {filteredTasks.map((task) => {
              const isEditing = editingTaskId === task.id;

              return (
                <article
                  key={task.id}
                  className={`task-item ${task.completed ? 'completed' : ''}`}
                >
                  <button
                    type="button"
                    className={`toggle ${task.completed ? 'done' : ''}`}
                    onClick={() => handleToggleTask(task)}
                    aria-label={
                      task.completed
                        ? `Mark ${task.title} as pending`
                        : `Mark ${task.title} as completed`
                    }
                  >
                    <span />
                  </button>

                  <div className="task-content">
                    {isEditing ? (
                      <div className="edit-row">
                        <input
                          type="text"
                          value={editingTaskTitle}
                          onChange={(event) => setEditingTaskTitle(event.target.value)}
                          aria-label="Edit task title"
                        />
                        <div className="edit-actions">
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => handleSaveEdit(task.id)}
                          >
                            Save
                          </button>
                          <button type="button" className="ghost" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h2>{task.title}</h2>
                        <p>
                          {task.completed ? 'Completed' : 'Pending'} • Updated{' '}
                          {formatTimestamp(task.updated_at)}
                        </p>
                      </>
                    )}
                  </div>

                  {!isEditing ? (
                    <div className="task-actions">
                      <button type="button" className="ghost" onClick={() => beginEdit(task)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="ghost danger"
                        onClick={() => handleDeleteTask(task.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>
        </section>
      </main>
    </div>
  );
}

export default App;
