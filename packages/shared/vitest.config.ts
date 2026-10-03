export default { test: { include: ['tests/**/*.test.ts'] }, resolve: { alias: { vitest: new URL('../parsers/node_modules/vitest/dist/index.js', import.meta.url).pathname } } };
