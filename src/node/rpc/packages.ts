import { promises as fsp } from 'node:fs'
import { resolve } from 'pathe'
import type { PackageMeta } from '../../types'

// 获取项目包依赖信息vue 版本等
export async function getPackages(root: string) {
  // TODO: support monorepo workspace ?
  // 很简单，就是通过 fs 读取 package.json 字段，然后对其dep做分类
  const pkgPath = resolve(root, 'package.json')
  const data = JSON.parse(await fsp.readFile(pkgPath, 'utf-8').catch(() => '{}'))
  const packages: Record<string, Omit<PackageMeta, 'name'>> = {}

  for (const type of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    const dep = data[type]
    if (!dep)
      continue
    for (const depName in dep) {
      packages[depName] = {
        version: dep[depName],
        type,
      }
    }
  }

  return {
    packages,
  }
}
