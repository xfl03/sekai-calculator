import typescript from '@rollup/plugin-typescript'
export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs'
    },
    {
      dir: 'dist/index.es.js',
      format: 'es'
    }
  ],
  plugins: [
    typescript()
  ]
}
