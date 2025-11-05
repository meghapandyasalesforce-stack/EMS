// Quick import test to validate errorHandler -> logger import resolution
import('./middlewares/errorHandler.js')
  .then(mod => {
    // Removed console.log for production
    process.exit(0);
  })
  .catch(err => {
    // Removed console.error for production
    process.exit(1);
  });
