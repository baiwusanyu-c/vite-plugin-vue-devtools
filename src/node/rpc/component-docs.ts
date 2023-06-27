import path from 'node:path'
import fg from 'fast-glob'
// 读取项目中所有的 sfc
export async function getVueSFCList(root: string) {
  const files = await fg([
    '**/*.vue',
  ], {
    cwd: root,
    onlyFiles: true,
    ignore: ['**/node_modules/**', '**/dist/**'],
  })
  return files
}

// 读取项目中所有的 sfc ，使用科比哥的 '@webfansplz/vuedoc-parser 解析 sfc 内容
export async function getComponentInfo(root: string, filename: string) {
  const { parseComponent } = await import('@webfansplz/vuedoc-parser')
  return await parseComponent({
    filename: path.resolve(root, filename),
  })
}
