// Quick import test to validate errorHandler -> logger import resolution
import('./middlewares/errorHandler.js')
  .then(mod => {
    console.log('Import succeeded:', Object.keys(mod));
    process.exit(0);
  })
  .catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
  });
