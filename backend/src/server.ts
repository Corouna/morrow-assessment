import app from './app';
import { env } from './config/env';

app.listen(env.port, () => {
  console.log(`Habit tracker API listening on port ${env.port}`);
});
