import type { RollupOptions } from 'rollup'
import typescript from '@rollup/plugin-typescript'
import dts from 'rollup-plugin-dts'
export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.cjs',
        format: 'cjs'
      },
      {
        file: 'dist/index.mjs',
        format: 'es'
      }
    ],
    plugins: [
      // @rollup/plugin-typescript v12 要求 declarationDir 位于输出文件所在目录内
      typescript({ declarationDir: 'dist/dts' })
    ]
  },
  {
    input: 'dist/dts/src/index.d.ts',
    output: [
      {
        file: 'dist/index.d.ts',
        format: 'es'
      }
    ],
    plugins: [
      dts()
    ]
  }
] as RollupOptions[]
