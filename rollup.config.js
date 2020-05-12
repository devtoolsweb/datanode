import path from 'path'
import pluginDts from 'rollup-plugin-dts'
import pluginTypescript from 'rollup-plugin-typescript2'
import { terser as pluginTerser } from 'rollup-plugin-terser'
import pkg from './package.json'
import tsconfig from './tsconfig.json'

const external = Object.keys(pkg.dependencies || {})
const buildDir = tsconfig.compilerOptions.outDir
const targetDir = 'dist'

const standardPlugins = [
  pluginTypescript({
    useTsconfigDeclarationDir: true,
    verbosity: 1
  })
]

if (process.env.BUILD === 'production') {
  standardPlugins.push(
    pluginTerser({
      output: { comments: false },
      toplevel: true
    })
  )
}

const makeConf = (input, file, format = 'cjs', plugins = null, sourcemap = true) => ({
  external,
  input,
  output: { file, format, sourcemap },
  plugins: plugins === null ? standardPlugins : plugins
})

export default [
  makeConf('lib/index.ts', path.join(targetDir, 'index.cjs.js')),
  makeConf('lib/index.ts', path.join(targetDir, 'index.esm.js'), 'es'),
  makeConf(
    path.join(...[buildDir, ...(tsconfig.include.length > 1 ? ['lib'] : []), 'index.d.ts']),
    path.join(targetDir, 'index.d.ts'),
    'es',
    [pluginDts({ verbose: true })],
    false
  )
]
