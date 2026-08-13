import { defineConfig } from 'orval';

export default defineConfig({
  samuraiworld: {
    input: {
      target: 'http://localhost:3000/api-json',
    },
    output: {
      mode: 'split',
      target: './src/app/api/generated',
      schemas: './src/app/api/model',
      client: 'angular',
      httpClient: 'fetch',
      override: {
        mutator: {
          path: './src/app/api/custom-instance.ts',
          name: 'customInstance',
        },
      },
    },
  },
});
