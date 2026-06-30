// Simple test to verify imports work
import('./src/main.tsx').catch(e => {
  console.error('Error:', e.message);
  console.error('Cause:', e.cause);
});
