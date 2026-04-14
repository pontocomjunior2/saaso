const path = require('path');
// Root project node_modules (hoisted — where @prisma/client lives)
const rootNodeModules = 'D:/Projetos/Saaso/node_modules';
// apps/api node_modules (where .prisma generated client lives)
const apiNodeModules = 'D:/Projetos/Saaso/apps/api/node_modules';

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: 'stage-rule.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: path.join(__dirname, 'tsconfig.jest.json'),
    }],
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@prisma/client$': path.join(rootNodeModules, '@prisma', 'client'),
    '^\\.prisma/client/default$': path.join(apiNodeModules, '.prisma', 'client', 'default'),
  },
  modulePaths: [
    rootNodeModules,
    apiNodeModules,
  ],
};
