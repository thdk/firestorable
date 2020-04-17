import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

const input = `src/index.ts`;
const external = [
  "mobx",
  "firebase/app",
  "firebase/firestore"
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
    resolve(),
    typescript({
      declaration: true,
      declarationDir: "./lib/types/",
      rootDir: 'src/'
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
  plugins: [
    commonjs(),
    resolve(),
    typescript(),
  ],
}];
