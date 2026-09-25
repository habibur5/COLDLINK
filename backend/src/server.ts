import { App } from './app.js';

const PORT = process.env.PORT || 5000;
const { app } = new App();


app.listen(PORT, () => {
  console.log(`Modular Monolith API running on port ${PORT}`);
});