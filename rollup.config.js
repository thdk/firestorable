import resolve from 'rollup-plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import commonJS from 'rollup-plugin-commonjs';

export default {
  input: 'src/index.ts', // can be a typescript file if we have a rollup typescript plugin
  output: {
    file: 'dist/index.js',
    format: 'iife',
    name: 'bundle'
  },
  external: ['mobx'],
  globals: {
    'mobx': 'mobx',
  },
  plugins: [
    resolve(),
    commonJS({
        include: 'node_modules/**'
      }),
    typescript()
  ],
  onwarn: function (warning) {
    // Suppress this error message:
    // "The 'this' keyword is equivalent to 'undefined' at the top level of an ES module, and has been rewritten"
    if (warning.code === 'THIS_IS_UNDEFINED') return;

    console.error(warning.message);
  }
};