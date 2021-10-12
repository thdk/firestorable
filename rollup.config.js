import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import builtins from 'rollup-plugin-node-builtins';

const input = `src/index.ts`;

const external = [
  "mobx",
  "firebase/auth",
  "firebase/firestore",
];

export default [{  // Commonjs
  input,
  output: [
    {
      dir: "./lib",
      name: 'firestorable',
      format: 'cjs',
      sourcemap: true
    },
  ],
  external,
  watch: {
    include: 'src/**',
  },
  plugins: [
    commonjs(),
    resolve({ preferBuiltins: true }),
    builtins(),
    typescript({
      declaration: true,
      declarationDir: "./lib/types/",
      rootDir: 'src/',
      skipLibCheck: true,
      exclude: ["**/*.test.ts"]
    }),
  ],
},
//ES
{
  input,
  output: {
    file: "es/index.js",
    format: 'es',
    sourcemap: true
  },
  external,
  plugins: [
    commonjs(),
    resolve({ preferBuiltins: true }),
    builtins(),
    typescript(),
  ],
},
];
