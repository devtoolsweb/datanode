import path from 'path'
import pluginTypescript from 'rollup-plugin-typescript2'
import pluginDts from 'rollup-plugin-dts'
import { terser as pluginTerser } from 'rollup-plugin-terser'
import pkg from './package.json'

const external = [
  ...Object.keys(process.binding('natives')),
  ...Object.keys(pkg.dependencies || {})
]

const targetDir = 'dist'

const plugins = [
  pluginTypescript({
    useTsconfigDeclarationDir: true,
    verbosity: 1
  })
]

if (process.env.BUILD === 'production') {
  plugins.push(
    pluginTerser({
      output: { comments: false },
      toplevel: true
    })
  )
}

export default [
  {
    input: 'lib/index.ts',
    external,
    output: {
      file: path.join(targetDir, 'index.js'),
      format: 'cjs',
      name: 'index',
      sourcemap: true
    },
    plugins
  },
  {
    input: './build/lib/index.d.ts',
    output: [{ file: path.join(targetDir, 'index.d.ts'), format: 'es' }],
    plugins: [pluginDts({ verbose: true })]
  }
]
