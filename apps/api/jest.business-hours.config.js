module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: 'business-hours\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: require('path').join(__dirname, 'tsconfig.jest.json'),
    }],
  },
  testEnvironment: 'node',
};
