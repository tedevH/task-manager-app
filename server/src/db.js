import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Add a Postgres connection string before starting the server.'
  );
}

const pool = new Pool({
  connectionString,
  ssl:
    process.env.NODE_ENV === 'production'
      ? {
          rejectUnauthorized: false
        }
      : false
});

let schemaReadyPromise;

function normalizeTask(task) {
  return {
    ...task,
    completed: Boolean(task.completed)
  };
}

export async function ensureSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  await schemaReadyPromise;
}

export async function getTasks() {
  await ensureSchema();
  const result = await pool.query(`
    SELECT
      id,
      title,
      completed,
      created_at,
      updated_at
    FROM tasks
    ORDER BY updated_at DESC, id DESC
  `);

  return result.rows.map(normalizeTask);
}

export async function createTask(title) {
  await ensureSchema();
  const result = await pool.query(
    `
      INSERT INTO tasks (title)
      VALUES ($1)
      RETURNING id, title, completed, created_at, updated_at
    `,
    [title]
  );

  return normalizeTask(result.rows[0]);
}

export async function getTaskById(id) {
  await ensureSchema();
  const result = await pool.query(
    `
    SELECT
      id,
      title,
      completed,
      created_at,
      updated_at
    FROM tasks
    WHERE id = $1
    `,
    [id]
  );

  const task = result.rows[0];
  if (!task) {
    return null;
  }

  return normalizeTask(task);
}

export async function updateTask(id, updates) {
  await ensureSchema();
  const currentTask = await getTaskById(id);
  if (!currentTask) {
    return null;
  }

  const nextTask = {
    title: typeof updates.title === 'string' ? updates.title : currentTask.title,
    completed: typeof updates.completed === 'boolean' ? updates.completed : currentTask.completed
  };

  const result = await pool.query(
    `
      UPDATE tasks
      SET title = $1,
          completed = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING id, title, completed, created_at, updated_at
    `,
    [nextTask.title, nextTask.completed, id]
  );

  return normalizeTask(result.rows[0]);
}

export async function deleteTask(id) {
  await ensureSchema();
  const result = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
  return result.rowCount > 0;
}
