import dotenv from 'dotenv';
import { App } from './app';

dotenv.config();

async function main(): Promise<void> {
  const app = new App();
  
  app.listen();

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    app.close();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    app.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error during startup:', error);
  process.exit(1);
});