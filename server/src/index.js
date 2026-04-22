import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createTask,
  deleteTask,
  ensureSchema,
  getTaskById,
  getTasks,
  updateTask
} from './db.js';

const app = express();
const PORT = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const origins = allowedOrigins.length > 0 ? allowedOrigins : defaultOrigins;
      callback(null, origins.includes(origin));
    },
    credentials: false
  })
);
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', database: 'postgres' });
});

app.get('/api/tasks', async (_request, response, next) => {
  try {
    response.json({ tasks: await getTasks() });
  } catch (error) {
    next(error);
  }
});

app.post('/api/tasks', async (request, response, next) => {
  const title = request.body?.title?.trim();

  if (!title) {
    response.status(400).json({ message: 'Task title is required.' });
    return;
  }

  try {
    const task = await createTask(title);
    response.status(201).json({ task });
  } catch (error) {
    next(error);
  }
});

app.put('/api/tasks/:id', async (request, response, next) => {
  const taskId = Number(request.params.id);

  if (Number.isNaN(taskId)) {
    response.status(400).json({ message: 'Invalid task id.' });
    return;
  }

  if (typeof request.body?.title === 'string' && !request.body.title.trim()) {
    response.status(400).json({ message: 'Task title cannot be empty.' });
    return;
  }

  try {
    const task = await updateTask(taskId, {
      title: typeof request.body?.title === 'string' ? request.body.title.trim() : undefined,
      completed:
        typeof request.body?.completed === 'boolean' ? request.body.completed : undefined
    });

    if (!task) {
      response.status(404).json({ message: 'Task not found.' });
      return;
    }

    response.json({ task });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/tasks/:id', async (request, response, next) => {
  const taskId = Number(request.params.id);

  if (Number.isNaN(taskId)) {
    response.status(400).json({ message: 'Invalid task id.' });
    return;
  }

  try {
    const task = await getTaskById(taskId);
    if (!task) {
      response.status(404).json({ message: 'Task not found.' });
      return;
    }

    await deleteTask(taskId);
    response.json({ message: 'Task deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(clientDistPath));

app.get('*', (request, response, next) => {
  if (request.path.startsWith('/api/')) {
    next();
    return;
  }

  response.sendFile(path.join(clientDistPath, 'index.html'), (error) => {
    if (error) {
      response.status(500).json({
        message: 'Frontend build not found. Run `npm run build` before starting production.'
      });
    }
  });
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({
    message: 'Something went wrong while processing the request.'
  });
});

ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Task manager server is running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize the database schema.', error);
    process.exit(1);
  });
