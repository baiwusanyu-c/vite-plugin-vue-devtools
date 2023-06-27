import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { normalizePath } from 'vite'
import type { PluginOption, ResolvedConfig, ViteDevServer } from 'vite'
import sirv from 'sirv'
import Inspect from 'vite-plugin-inspect'
import VueInspector from 'vite-plugin-vue-inspector'
import { createRPCServer } from '../vite-dev-rpc'
import { DIR_CLIENT } from '../dir'
import type { ExecNpmScriptOptions, RPCFunctions } from '../types'
import { execNpmScript, getComponentInfo, getComponentsRelationships, getImageMeta, getPackages, getStaticAssets, getTextAssetContent, getVueSFCList } from './rpc'

const NAME = 'vite-plugin-vue-devtools'

function getVueDevtoolsPath() {
  const pluginPath = normalizePath(path.dirname(fileURLToPath(import.meta.url)))
  return pluginPath.replace(/\/dist$/, '/\/src/node')
}

export interface VitePluginVueDevToolsOptions {
  /**
  * append an import to the module id ending with `appendTo` instead of adding a script into body
  * useful for projects that do not use html file as an entry
  *
  * WARNING: only set this if you know exactly what it does.
  */
  appendTo?: string | RegExp
}

export default function VitePluginVueDevTools(options: VitePluginVueDevToolsOptions = { appendTo: '' }): PluginOption {
  const vueDevtoolsPath = getVueDevtoolsPath()
  const inspect = Inspect({
    silent: true,
  })
  let config: ResolvedConfig

  // 基于 vite 的server 自定义服务
  function configureServer(server: ViteDevServer) {
    const base = (server.config.base) || '/'
    // 创建一个中间件，插件客户端的请求，例如一些分析数据，都会在这个中间件处理
    server.middlewares.use(`${base}__devtools__`, sirv(DIR_CLIENT, {
      single: true,
      dev: true,
    }))

    // 创建一个通信服务，用于与客户端通信
    const rpc = createRPCServer<RPCFunctions>('vite-plugin-vue-devtools', server.ws, {
      // TODO: 处理组件力导图
      componentGraph: () => getComponentsRelationships(inspect.api.rpc),
      // TODO：vue inspect
      inspectClientUrl: () => `${config.base || '/'}__inspect/`,
      // 获取项目静态资源
      staticAssets: () => getStaticAssets(config),
      // 根据文件路径获取图片元信息宽、高、尺寸等
      getImageMeta,
      // 根据文件路径获取文本类静态资源的缩略内容
      getTextAssetContent,
      // 获取项目包依赖信息vue 版本等
      getPackages: async () => {
        const res = await getPackages(config.root)
        // 一个包含了项目依赖的对象，有名称，版本、是否时dev依赖
        return res
      },
      // 获取vueSFC列表, 包含项目所有 sfc 文件的相对路径
      getVueSFCList: async () => {
        const res = await getVueSFCList(config.root)
        // 包含项目所有 sfc 文件的相对路径
        return res
      },
      // 获取组件信息 根据文件名获取组件内容并解析，component docs 用到
      getComponentInfo: async (filename: string) => {
        // 组件解析内容，包含组件的名称，各种 option 等。。。
        const res = await getComponentInfo(config.root, filename)
        return res
      },
      // 安装项目依赖
      installPackage: (packages: string[], options: ExecNpmScriptOptions = {}) => execNpmScript(packages, {
        ...options,
        type: 'install',
        cwd: config.root,
        callback: (type: string, data: string) => {
          if (type === 'data')
            rpc.onTerminalData({ data })

          else if (type === 'exit')
            rpc.onTerminalExit({ data })
        },
      }),
      // 卸载项目依赖
      uninstallPackage: (packages: string[], options: ExecNpmScriptOptions = {}) => execNpmScript(packages, {
        ...options,
        type: 'uninstall',
        cwd: config.root,
        callback: (type: string, data: string) => {
          if (type === 'data')
            rpc.onTerminalData({ data })

          else if (type === 'exit')
            rpc.onTerminalExit({ data })
        },
      }),
    })
  }
  const plugin = <PluginOption>{
    name: NAME,
    enforce: 'pre',
    apply: 'serve',
    configResolved(resolvedConfig) {
      config = resolvedConfig
    },
    // 基于 vite 的server 自定义服务
    configureServer(server) {
      configureServer(server)
    },
    // 生成虚拟模块 id
    async resolveId(importee: string) {
      if (importee.startsWith('virtual:vue-devtools-options')) {
        return importee
      }
      // 如果模块包含 virtual:vue-devtools-path:，则将其替换为真实的路径
      // 比如将 virtual:vue-devtools-path:app.js 替换为执行真实的 app.js 的路径
      else if (importee.startsWith('virtual:vue-devtools-path:')) {
        const resolved = importee.replace('virtual:vue-devtools-path:', `${vueDevtoolsPath}/`)
        return resolved
      }
    },
    // 返回虚拟模块 'virtual:vue-devtools-options' 代码
    async load(id) {
      if (id === 'virtual:vue-devtools-options')
        return `export default ${JSON.stringify({ base: config.base })}`
    },
    // 处理 appendTo 选项，如果设置了，就不把 app.js 添加到 body
    // 而是添加到指定的 模块 id 中
    transform(code, id) {
      const { appendTo } = options

      if (!appendTo)
        return

      const [filename] = id.split('?', 2)
      if ((typeof appendTo === 'string' && filename.endsWith(appendTo))
        || (appendTo instanceof RegExp && appendTo.test(filename)))
        return { code: `${code}\nimport 'virtual:vue-devtools-path:app.js'` }
    },
    // 向 html 注入一个 script 标签，其中代码引入虚拟模块并执行
    // /@id/virtual:vue-devtools-path:app.js
    // 即 src/node/app.js
    transformIndexHtml(html) {
      if (options.appendTo)
        return

      return {
        html,
        tags: [
          {
            tag: 'script',
            injectTo: 'head',
            attrs: {
              type: 'module',
              src: '/@id/virtual:vue-devtools-path:app.js',
            },
          },
        ],
      }
    },
    async buildEnd() {
    },
  }

  return [
    plugin,
    inspect,
    VueInspector({
      toggleComboKey: '',
      toggleButtonVisibility: 'never',
    }),
  ]
}
